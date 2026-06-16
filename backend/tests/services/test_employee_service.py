from app.core.security import hash_password
from app.models.employee import Employee
from app.models.user import User
from app.services.employee_service import get_employee_for_user


def test_get_employee_for_user_returns_linked_employee(db):
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        department="People Operations",
        role="HR Specialist",
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="employee@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()

    result = get_employee_for_user(db, user)

    assert result is not None
    assert result.id == employee.id
    assert result.email == "employee@example.com"


def test_get_employee_for_user_returns_none_without_employee_link(db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )

    result = get_employee_for_user(db, user)

    assert result is None
