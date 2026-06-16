"""Leave agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.models.leave import LeaveRequest
from app.services.leave_service import list_leave_requests_for_employee


def _profile_not_linked(tool_name: str) -> dict:
    return {
        "error": "profile_not_linked",
        "tool": tool_name,
        "message": "Your user account is not linked to an employee profile.",
    }


def get_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("get_leave_request")

    return {
        "tool": "get_leave_request",
        "leave_requests": [
            _serialize_leave_request(request)
            for request in list_leave_requests_for_employee(db, context.employee)
        ],
    }


def submit_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    return _not_implemented("submit_leave_request")


def update_leave_status(db: Session, context: ToolContext, **kwargs) -> dict:
    return _not_implemented("update_leave_status")


def list_team_leave(db: Session, context: ToolContext, **kwargs) -> dict:
    return _not_implemented("list_team_leave")


def _not_implemented(tool_name: str) -> dict:
    return {
        "error": "not_implemented",
        "tool": tool_name,
        "message": "This agent tool is scaffolded but not implemented yet.",
    }


def _serialize_leave_request(request: LeaveRequest) -> dict:
    return {
        "id": str(request.id),
        "employee_id": str(request.employee_id),
        "leave_type": request.leave_type,
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "days_requested": request.days_requested,
        "status": request.status,
        "reason": request.reason,
        "approved_by": str(request.approved_by) if request.approved_by else None,
        "approved_at": request.approved_at.isoformat() if request.approved_at else None,
    }
