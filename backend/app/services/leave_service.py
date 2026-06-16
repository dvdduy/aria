from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.leave import LeaveRequest


def list_leave_requests_for_employee(db: Session, employee: Employee) -> list[LeaveRequest]:
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
