import pytest

from app.agent import tools as agent_tools
from app.agent.tools.context import ToolContext
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


def test_dispatch_tool_passes_trusted_context_separately_from_model_inputs(
    monkeypatch,
    db,
    tool_context,
):
    captured = {}

    def fake_tool(db, context, **kwargs):
        captured["db"] = db
        captured["context"] = context
        captured["kwargs"] = kwargs
        return {"ok": True}

    monkeypatch.setitem(agent_tools.TOOL_MAP, "fake_tool", fake_tool)

    result = agent_tools.dispatch_tool(
        "fake_tool",
        {"employee_id": "model-supplied-id"},
        db,
        tool_context,
    )

    assert result == {"ok": True}
    assert captured["db"] is db
    assert captured["context"].employee.id == tool_context.employee.id
    assert captured["kwargs"] == {"employee_id": "model-supplied-id"}


def test_dispatch_tool_returns_safe_error_for_unknown_tool(db, tool_context):
    result = agent_tools.dispatch_tool("missing_tool", {}, db, tool_context)

    assert result == {
        "error": "unknown_tool",
        "tool": "missing_tool",
        "message": "Unknown tool: missing_tool",
    }


def test_dispatch_tool_returns_safe_error_for_tool_failure(
    monkeypatch,
    db,
    tool_context,
):
    def failing_tool(db, context, **kwargs):
        raise ValueError("boom")

    monkeypatch.setitem(agent_tools.TOOL_MAP, "failing_tool", failing_tool)

    result = agent_tools.dispatch_tool("failing_tool", {}, db, tool_context)

    assert result == {
        "error": "tool_failed",
        "tool": "failing_tool",
        "message": "The tool failed while processing the request.",
    }
