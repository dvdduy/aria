"""Employee agent tools."""

from datetime import date

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import invalid_request, not_found, profile_not_linked
from app.models.employee import Employee
from app.services.employee_service import list_direct_reports
from app.services.leave_service import get_annual_leave_balance, list_leave_requests_for_employee


def get_employee_info(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("get_employee_info")

    return {
        "tool": "get_employee_info",
        "employee": _serialize_employee(context.employee),
    }


def get_team_member(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("get_team_member")

    employee_name = (kwargs.get("employee_name") or "").strip()
    if not employee_name:
        return invalid_request("get_team_member", "employee_name is required")

    reports = list_direct_reports(db, context.employee)
    name_lower = employee_name.lower()
    matches = [e for e in reports if name_lower in e.full_name.lower()]

    if not matches:
        return not_found("get_team_member", f"No direct report found matching '{employee_name}'")

    target = matches[0]
    all_requests = list_leave_requests_for_employee(db, target)
    this_year = date.today().year
    year_requests = [r for r in all_requests if r.start_date.year == this_year]
    balance = get_annual_leave_balance(db, target)

    return {
        "tool": "get_team_member",
        "employee": _serialize_employee(target),
        "leave_this_year": [_serialize_leave(r) for r in year_requests],
        "annual_balance": balance,
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


def _serialize_leave(request) -> dict:
    return {
        "id": str(request.id),
        "leave_type": request.leave_type,
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "days_requested": request.days_requested,
        "status": request.status,
    }
