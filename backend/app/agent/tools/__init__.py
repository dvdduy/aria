from app.agent.tools.employee_tools import get_employee_info
from app.agent.tools.leave_tools import (
    get_leave_request,
    list_team_leave,
    submit_leave_request,
    update_leave_status,
)
from app.agent.tools.notification_tools import send_notification
from app.agent.tools.payroll_tools import get_payroll_summary
from app.agent.tools.policy_tools import get_policy

TOOL_MAP = {
    "get_employee_info": get_employee_info,
    "get_leave_request": get_leave_request,
    "submit_leave_request": submit_leave_request,
    "update_leave_status": update_leave_status,
    "list_team_leave": list_team_leave,
    "get_policy": get_policy,
    "get_payroll_summary": get_payroll_summary,
    "send_notification": send_notification,
}


def dispatch_tool(name: str, inputs: dict, db) -> dict:
    fn = TOOL_MAP.get(name)
    if not fn:
        return {"error": f"Unknown tool: {name}"}
    try:
        return fn(db=db, **inputs)
    except Exception as exc:
        return {"error": str(exc)}
