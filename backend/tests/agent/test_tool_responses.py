from app.agent.tools.responses import (
    invalid_request,
    not_authorized,
    not_found,
    not_implemented,
    profile_not_linked,
    tool_failed,
    unknown_tool,
)


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


