from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.user import User
from app.services.employee_service import get_employee_for_user


@dataclass(frozen=True)
class ToolContext:
    user: User
    employee: Employee | None
    is_admin: bool


def build_tool_context(db: Session, user: User) -> ToolContext:
    return ToolContext(
        user=user,
        employee=get_employee_for_user(db, user),
        is_admin=user.is_admin,
    )
