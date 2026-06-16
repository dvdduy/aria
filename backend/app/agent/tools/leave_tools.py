"""Leave agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import (
    invalid_request,
    not_authorized,
    not_found,
    not_implemented,
    profile_not_linked,
)
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestReject
from app.services.leave_service import (
    InvalidLeaveRequestError,
    LeaveAuthorizationError,
    LeaveRequestNotFoundError,
    approve_leave_request,
    list_leave_requests_for_employee,
    list_pending_leave_requests_for_manager,
    reject_leave_request,
)


def get_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("get_leave_request")

    return {
        "tool": "get_leave_request",
        "leave_requests": [
            _serialize_leave_request(request)
            for request in list_leave_requests_for_employee(db, context.employee)
        ],
    }


def submit_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    return not_implemented("submit_leave_request")


def update_leave_status(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("update_leave_status")

    request_id = kwargs.get("request_id")
    status = kwargs.get("status")
    if not request_id:
        return invalid_request("update_leave_status", "request_id is required")

    try:
        if status == "approved":
            request = approve_leave_request(db, context.employee, request_id)
        elif status == "rejected":
            rejection_reason = kwargs.get("rejection_reason")
            if not rejection_reason or not rejection_reason.strip():
                return invalid_request(
                    "update_leave_status",
                    "rejection_reason is required",
                )
            request = reject_leave_request(
                db,
                context.employee,
                request_id,
                LeaveRequestReject(rejection_reason=rejection_reason),
            )
        else:
            return invalid_request(
                "update_leave_status",
                "status must be approved or rejected",
            )
    except LeaveRequestNotFoundError as exc:
        return not_found("update_leave_status", str(exc))
    except LeaveAuthorizationError as exc:
        return not_authorized("update_leave_status", str(exc))
    except InvalidLeaveRequestError as exc:
        return invalid_request("update_leave_status", str(exc))

    return {
        "tool": "update_leave_status",
        "leave_request": _serialize_leave_request(request),
    }


def list_team_leave(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("list_team_leave")

    return {
        "tool": "list_team_leave",
        "leave_requests": [
            _serialize_leave_request(request)
            for request in list_pending_leave_requests_for_manager(db, context.employee)
        ],
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
