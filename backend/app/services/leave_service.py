from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate
from app.services.employee_service import can_manage_employee, list_direct_reports


class InvalidLeaveRequestError(ValueError):
    pass


class LeaveRequestNotFoundError(ValueError):
    pass


class LeaveAuthorizationError(PermissionError):
    pass


def list_leave_requests_for_employee(db: Session, employee: Employee) -> list[LeaveRequest]:
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )


def get_leave_request_for_employee(
    db: Session,
    employee: Employee,
    request_id,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    if request.employee_id == employee.id:
        return request

    request_employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if request_employee and can_manage_employee(employee, request_employee):
        return request

    raise LeaveAuthorizationError("Not authorized to access this leave request")


def list_pending_leave_requests_for_manager(
    db: Session,
    manager: Employee,
) -> list[LeaveRequest]:
    direct_reports = list_direct_reports(db, manager)
    direct_report_ids = [employee.id for employee in direct_reports]
    if not direct_report_ids:
        return []
    return (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id.in_(direct_report_ids),
            LeaveRequest.status == "pending",
        )
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )


def submit_leave_request(
    db: Session,
    employee: Employee,
    payload: LeaveRequestCreate,
) -> LeaveRequest:
    if payload.end_date < payload.start_date:
        raise InvalidLeaveRequestError("End date must be on or after start date")

    days_requested = (payload.end_date - payload.start_date).days + 1
    request = LeaveRequest(
        employee_id=employee.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days_requested=days_requested,
        status="pending",
        reason=payload.reason,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def approve_leave_request(
    db: Session,
    manager: Employee,
    request_id,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee or not can_manage_employee(manager, employee):
        raise LeaveAuthorizationError("Not authorized to approve this leave request")

    if request.status != "pending":
        raise InvalidLeaveRequestError("Leave request is not pending")

    request.status = "approved"
    request.approved_by = manager.id
    request.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request
