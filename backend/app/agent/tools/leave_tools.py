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
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate, LeaveRequestReject
from app.services.leave_service import (
    InvalidLeaveRequestError,
    LeaveAuthorizationError,
    LeaveRequestNotFoundError,
    approve_leave_request,
    get_annual_leave_balance,
    list_leave_requests_for_employee,
    list_team_leave_by_status,
    reject_leave_request,
    submit_leave_request as _do_submit_leave_request,
)


def get_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("get_leave_request")

    return {
        "tool": "get_leave_request",
        "leave_requests": [
            _serialize_leave_request(request, context.employee.full_name)
            for request in list_leave_requests_for_employee(db, context.employee)
        ],
    }


def submit_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("submit_leave_request")

    leave_type = kwargs.get("leave_type")
    start_date = kwargs.get("start_date")
    end_date = kwargs.get("end_date")
    reason = kwargs.get("reason")

    if not leave_type or not start_date or not end_date:
        return invalid_request(
            "submit_leave_request",
            "leave_type, start_date, and end_date are required",
        )

    try:
        payload = LeaveRequestCreate(
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
        )
        request = _do_submit_leave_request(db, context.employee, payload)
    except InvalidLeaveRequestError as exc:
        return invalid_request("submit_leave_request", str(exc))
    except Exception as exc:
        return invalid_request("submit_leave_request", f"Invalid input: {exc}")

    return {
        "tool": "submit_leave_request",
        "leave_request": _serialize_leave_request(request, context.employee.full_name),
    }


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

    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    employee_name = employee.full_name if employee else None
    return {
        "tool": "update_leave_status",
        "leave_request": _serialize_leave_request(request, employee_name),
    }


def get_leave_balance(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("get_leave_balance")

    balance = get_annual_leave_balance(db, context.employee)
    return {
        "tool": "get_leave_balance",
        "employee_name": context.employee.full_name,
        "balance": balance,
    }


def list_team_leave(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("list_team_leave")

    status = kwargs.get("status", "pending")
    requests = list_team_leave_by_status(db, context.employee, status=status)
    emp_ids = {r.employee_id for r in requests}
    employees = {
        e.id: e
        for e in db.query(Employee).filter(Employee.id.in_(emp_ids)).all()
    }
    return {
        "tool": "list_team_leave",
        "status_filter": status,
        "leave_requests": [
            _serialize_leave_request(r, employees[r.employee_id].full_name if r.employee_id in employees else None)
            for r in requests
        ],
    }


def _serialize_leave_request(request: LeaveRequest, employee_name: str | None = None) -> dict:
    return {
        "id": str(request.id),
        "employee_id": str(request.employee_id),
        "employee_name": employee_name,
        "leave_type": request.leave_type,
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "days_requested": request.days_requested,
        "status": request.status,
        "reason": request.reason,
        "approved_by": str(request.approved_by) if request.approved_by else None,
        "approved_at": request.approved_at.isoformat() if request.approved_at else None,
    }
