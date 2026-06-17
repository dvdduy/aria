from app.agent.tools.context import ToolContext
from app.agent.tools.employee_tools import get_employee_info
from app.agent.tools.leave_tools import (
    get_leave_balance,
    get_leave_request,
    list_team_leave,
    submit_leave_request,
    update_leave_status,
)
from app.agent.tools.notification_tools import send_notification
from app.agent.tools.payroll_tools import get_payroll_summary
from app.agent.tools.policy_tools import get_policy
from app.agent.tools.responses import tool_failed, unknown_tool
from app.core.logging import logger

TOOL_MAP = {
    "get_employee_info": get_employee_info,
    "get_leave_request": get_leave_request,
    "get_leave_balance": get_leave_balance,
    "submit_leave_request": submit_leave_request,
    "update_leave_status": update_leave_status,
    "list_team_leave": list_team_leave,
    "get_policy": get_policy,
    "get_payroll_summary": get_payroll_summary,
    "send_notification": send_notification,
}


def dispatch_tool(name: str, inputs: dict, db, context: ToolContext) -> dict:
    fn = TOOL_MAP.get(name)
    if not fn:
        result = unknown_tool(name)
        log_tool_result(name, result, context)
        return result
    try:
        result = fn(db=db, context=context, **inputs)
    except Exception:
        result = tool_failed(name)

    log_tool_result(name, result, context)
    return result


def summarize_tool_result(result: dict) -> str:
    if error_code := result.get("error"):
        return f"error:{error_code}"
    if "employee" in result:
        return "employee_profile_returned"
    if "leave_requests" in result:
        return f"leave_requests:{len(result['leave_requests'])}"
    if "leave_request" in result:
        return f"leave_request:{result['leave_request'].get('status', 'unknown')}"
    if "payroll_records" in result:
        return f"payroll_records:{len(result['payroll_records'])}"
    if "policy" in result:
        policy = result["policy"]
        return (
            f"policy:{policy.get('title', 'unknown')}:"
            f"{policy.get('version', 'unknown')}"
        )
    return "success"


def build_tool_trace_step(name: str, result: dict) -> dict:
    error_code = result.get("error")
    return {
        "tool": name,
        "status": "error" if error_code else "success",
        "summary": summarize_tool_result(result),
        "error_code": error_code,
    }


def log_tool_result(name: str, result: dict, context: ToolContext) -> None:
    error_code = result.get("error")
    logger.info(
        "agent_tool_called",
        tool=name,
        user_id=str(context.user.id),
        employee_id=str(context.employee.id) if context.employee else None,
        is_admin=context.is_admin,
        result_status="error" if error_code else "success",
        error_code=error_code,
        summary=summarize_tool_result(result),
    )
