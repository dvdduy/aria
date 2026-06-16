from app.agent.tools.context import ToolContext
from app.agent.tools.employee_tools import get_employee_info
from app.models.employee import Employee
from app.models.user import User


def test_get_employee_info_returns_context_employee(db):
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        department="People Operations",
        role="HR Coordinator",
        is_active=True,
    )
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

    result = get_employee_info(db, context, employee_id="model-supplied-id")

    assert result["tool"] == "get_employee_info"
    assert result["employee"] == {
        "id": str(employee.id),
        "email": "employee@example.com",
        "full_name": "Example Employee",
        "department": "People Operations",
        "role": "HR Coordinator",
        "manager_id": None,
        "is_active": True,
    }


def test_get_employee_info_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_employee_info(db, context)

    assert result == {
        "error": "profile_not_linked",
        "tool": "get_employee_info",
        "message": "Your user account is not linked to an employee profile.",
    }
