from datetime import date

from app.agent.tools.context import ToolContext
from app.agent.tools.leave_tools import get_leave_request
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.user import User


def test_get_leave_request_returns_context_employee_leave_requests(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    other_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([employee, other_employee])
    db.commit()
    db.refresh(employee)
    db.refresh(other_employee)

    own_request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
        reason="Family vacation",
    )
    other_request = LeaveRequest(
        employee_id=other_employee.id,
        leave_type="sick",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 1),
        days_requested=1,
        status="pending",
    )
    db.add_all([own_request, other_request])
    db.commit()
    db.refresh(own_request)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = get_leave_request(db, context, employee_id=str(other_employee.id))

    assert result["tool"] == "get_leave_request"
    assert result["leave_requests"] == [
        {
            "id": str(own_request.id),
            "employee_id": str(employee.id),
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "days_requested": 5,
            "status": "pending",
            "reason": "Family vacation",
            "approved_by": None,
            "approved_at": None,
        }
    ]


def test_get_leave_request_returns_empty_list_when_user_has_no_leave(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = get_leave_request(db, context)

    assert result == {
        "tool": "get_leave_request",
        "leave_requests": [],
    }


def test_get_leave_request_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_leave_request(db, context)

    assert result == {
        "error": "profile_not_linked",
        "tool": "get_leave_request",
        "message": "Your user account is not linked to an employee profile.",
    }
