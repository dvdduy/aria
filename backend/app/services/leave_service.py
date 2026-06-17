from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate, LeaveRequestReject
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


def list_all_leave_requests_for_manager(
    db: Session,
    manager: Employee,
) -> list[LeaveRequest]:
    direct_reports = list_direct_reports(db, manager)
    direct_report_ids = [employee.id for employee in direct_reports]
    if not direct_report_ids:
        return []
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id.in_(direct_report_ids))
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )


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


def get_annual_leave_balance(db: Session, employee: Employee) -> dict:
    year = date.today().year
    start_of_year = date(year, 1, 1)
    end_of_year = date(year, 12, 31)

    approved = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.leave_type == "annual",
            LeaveRequest.status == "approved",
            LeaveRequest.start_date >= start_of_year,
            LeaveRequest.start_date <= end_of_year,
        )
        .all()
    )
    used_days = sum(r.days_requested for r in approved)
    entitlement = 20
    return {
        "year": year,
        "entitlement_days": entitlement,
        "used_days": used_days,
        "remaining_days": max(0, entitlement - used_days),
    }


def list_team_leave_by_status(
    db: Session,
    manager: Employee,
    status: str | None = None,
) -> list[LeaveRequest]:
    direct_reports = list_direct_reports(db, manager)
    direct_report_ids = [e.id for e in direct_reports]
    if not direct_report_ids:
        return []
    q = db.query(LeaveRequest).filter(LeaveRequest.employee_id.in_(direct_report_ids))
    if status and status != "all":
        q = q.filter(LeaveRequest.status == status)
    return q.order_by(LeaveRequest.start_date.asc()).all()


def cancel_leave_request(
    db: Session,
    employee: Employee,
    request_id,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    if request.employee_id != employee.id:
        raise LeaveAuthorizationError("Not authorized to cancel this leave request")

    if request.status != "pending":
        raise InvalidLeaveRequestError("Only pending requests can be cancelled")

    request.status = "cancelled"
    db.commit()
    db.refresh(request)
    return request


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


def reject_leave_request(
    db: Session,
    manager: Employee,
    request_id,
    payload: LeaveRequestReject,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee or not can_manage_employee(manager, employee):
        raise LeaveAuthorizationError("Not authorized to reject this leave request")

    if request.status != "pending":
        raise InvalidLeaveRequestError("Leave request is not pending")

    request.status = "rejected"
    request.approved_by = manager.id
    request.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request
