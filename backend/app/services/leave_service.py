from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate


class InvalidLeaveRequestError(ValueError):
    pass


def list_leave_requests_for_employee(db: Session, employee: Employee) -> list[LeaveRequest]:
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee.id)
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
