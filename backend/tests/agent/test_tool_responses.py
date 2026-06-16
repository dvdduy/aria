import pytest

from app.agent.tools.context import ToolContext
from app.agent.tools.leave_tools import submit_leave_request
from app.agent.tools.notification_tools import send_notification
from app.agent.tools.policy_tools import get_policy
from app.agent.tools.responses import (
    invalid_request,
    not_authorized,
    not_found,
    not_implemented,
    profile_not_linked,
    tool_failed,
    unknown_tool,
)
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


def test_tool_response_helpers_return_standard_error_shape():
    assert unknown_tool("missing_tool") == {
        "error": "unknown_tool",
        "tool": "missing_tool",
        "message": "Unknown tool: missing_tool",
    }
    assert tool_failed("failing_tool") == {
        "error": "tool_failed",
        "tool": "failing_tool",
        "message": "The tool failed while processing the request.",
    }
    assert not_implemented("send_notification") == {
        "error": "not_implemented",
        "tool": "send_notification",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
    assert profile_not_linked("get_employee_info") == {
        "error": "profile_not_linked",
        "tool": "get_employee_info",
        "message": "Your user account is not linked to an employee profile.",
    }
    assert not_authorized("update_leave_status", "Not authorized") == {
        "error": "not_authorized",
        "tool": "update_leave_status",
        "message": "Not authorized",
    }
    assert invalid_request("update_leave_status", "Invalid request") == {
        "error": "invalid_request",
        "tool": "update_leave_status",
        "message": "Invalid request",
    }
    assert not_found("update_leave_status", "Leave request not found") == {
        "error": "not_found",
        "tool": "update_leave_status",
        "message": "Leave request not found",
    }


def test_scaffolded_tools_return_consistent_not_implemented(db, tool_context):
    assert submit_leave_request(db, tool_context) == not_implemented("submit_leave_request")
    assert get_policy(db, tool_context) == not_implemented("get_policy")
    assert send_notification(db, tool_context) == not_implemented("send_notification")
