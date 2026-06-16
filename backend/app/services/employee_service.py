from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.user import User


def get_employee_for_user(db: Session, user: User) -> Employee | None:
    if not user.employee_id:
        return None
    return db.query(Employee).filter(Employee.id == user.employee_id).first()
