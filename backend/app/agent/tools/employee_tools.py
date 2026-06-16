"""Employee agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.models.employee import Employee


def _profile_not_linked(tool_name: str) -> dict:
    return {
        "error": "profile_not_linked",
        "tool": tool_name,
        "message": "Your user account is not linked to an employee profile.",
    }


def get_employee_info(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("get_employee_info")

    return {
        "tool": "get_employee_info",
        "employee": _serialize_employee(context.employee),
    }


def _serialize_employee(employee: Employee) -> dict:
    return {
        "id": str(employee.id),
        "email": employee.email,
        "full_name": employee.full_name,
        "department": employee.department,
        "role": employee.role,
        "manager_id": str(employee.manager_id) if employee.manager_id else None,
        "is_active": employee.is_active,
    }
