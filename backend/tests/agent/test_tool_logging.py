import pytest

from app.agent import tools as agent_tools
from app.agent.tools.context import ToolContext
from app.agent.tools.responses import not_authorized
from app.models.employee import Employee
from app.models.user import User


@pytest.fixture
def tool_context(db):
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return ToolContext(user=user, employee=employee, is_admin=False)


def test_summarize_tool_result_counts_collections():
    assert agent_tools.summarize_tool_result({"leave_requests": [{}, {}]}) == "leave_requests:2"
    assert agent_tools.summarize_tool_result({"payroll_records": [{}]}) == "payroll_records:1"


def test_summarize_tool_result_handles_known_success_shapes():
    assert agent_tools.summarize_tool_result({"employee": {"id": "employee-1"}}) == (
        "employee_profile_returned"
    )
    assert agent_tools.summarize_tool_result(
        {"leave_request": {"status": "approved", "id": "leave-1"}}
    ) == "leave_request:approved"
    assert agent_tools.summarize_tool_result(
        {"policy": {"title": "Annual Leave Policy", "version": "v2.0"}}
    ) == "policy:Annual Leave Policy:v2.0"
    assert agent_tools.summarize_tool_result({"ok": True}) == "success"


def test_summarize_tool_result_handles_errors():
    assert agent_tools.summarize_tool_result({"error": "not_authorized"}) == (
        "error:not_authorized"
    )


def test_build_tool_trace_step_uses_safe_summary():
    assert agent_tools.build_tool_trace_step(
        "update_leave_status",
        {"leave_request": {"status": "approved", "id": "leave-1"}},
    ) == {
        "tool": "update_leave_status",
        "status": "success",
        "summary": "leave_request:approved",
        "error_code": None,
    }
    assert agent_tools.build_tool_trace_step(
        "update_leave_status",
        {"error": "not_authorized", "message": "Not authorized"},
    ) == {
        "tool": "update_leave_status",
        "status": "error",
        "summary": "error:not_authorized",
        "error_code": "not_authorized",
    }


def test_dispatch_tool_logs_success(monkeypatch, db, tool_context):
    events = []

    class FakeLogger:
        def info(self, event, **kwargs):
            events.append((event, kwargs))

    def fake_tool(db, context, **kwargs):
        return {"ok": True}

    monkeypatch.setattr(agent_tools, "logger", FakeLogger())
    monkeypatch.setitem(agent_tools.TOOL_MAP, "fake_tool", fake_tool)

    agent_tools.dispatch_tool("fake_tool", {}, db, tool_context)

    assert events == [
        (
            "agent_tool_called",
            {
                "tool": "fake_tool",
                "user_id": str(tool_context.user.id),
                "employee_id": str(tool_context.employee.id),
                "is_admin": False,
                "result_status": "success",
                "error_code": None,
                "summary": "success",
            },
        )
    ]


def test_dispatch_tool_logs_error_result(monkeypatch, db, tool_context):
    events = []

    class FakeLogger:
        def info(self, event, **kwargs):
            events.append((event, kwargs))

    def fake_tool(db, context, **kwargs):
        return not_authorized("fake_tool", "Not authorized")

    monkeypatch.setattr(agent_tools, "logger", FakeLogger())
    monkeypatch.setitem(agent_tools.TOOL_MAP, "fake_tool", fake_tool)

    agent_tools.dispatch_tool("fake_tool", {}, db, tool_context)

    assert events[0][0] == "agent_tool_called"
    assert events[0][1]["tool"] == "fake_tool"
    assert events[0][1]["result_status"] == "error"
    assert events[0][1]["error_code"] == "not_authorized"
    assert events[0][1]["summary"] == "error:not_authorized"


def test_dispatch_tool_logs_unknown_tool(monkeypatch, db, tool_context):
    events = []

    class FakeLogger:
        def info(self, event, **kwargs):
            events.append((event, kwargs))

    monkeypatch.setattr(agent_tools, "logger", FakeLogger())

    result = agent_tools.dispatch_tool("missing_tool", {}, db, tool_context)

    assert result["error"] == "unknown_tool"
    assert events[0][0] == "agent_tool_called"
    assert events[0][1]["tool"] == "missing_tool"
    assert events[0][1]["result_status"] == "error"
    assert events[0][1]["error_code"] == "unknown_tool"
    assert events[0][1]["summary"] == "error:unknown_tool"


def test_dispatch_tool_logs_tool_failure_without_exception_text(monkeypatch, db, tool_context):
    events = []

    class FakeLogger:
        def info(self, event, **kwargs):
            events.append((event, kwargs))

    def failing_tool(db, context, **kwargs):
        raise ValueError("sensitive failure detail")

    monkeypatch.setattr(agent_tools, "logger", FakeLogger())
    monkeypatch.setitem(agent_tools.TOOL_MAP, "failing_tool", failing_tool)

    result = agent_tools.dispatch_tool("failing_tool", {}, db, tool_context)

    assert result["message"] == "The tool failed while processing the request."
    assert "sensitive failure detail" not in str(events)
    assert events[0][1]["summary"] == "error:tool_failed"
