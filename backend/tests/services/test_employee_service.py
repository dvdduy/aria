from app.core.security import hash_password
from app.models.employee import Employee
from app.models.user import User
from app.services.employee_service import get_employee_for_user, list_direct_reports


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


def test_list_direct_reports_returns_only_active_direct_reports(db):
    manager = Employee(
        email="manager@example.com",
        full_name="Example Manager",
    )
    other_manager = Employee(
        email="other.manager@example.com",
        full_name="Other Manager",
    )
    db.add_all([manager, other_manager])
    db.commit()
    db.refresh(manager)
    db.refresh(other_manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    inactive_report = Employee(
        email="inactive.report@example.com",
        full_name="Inactive Report",
        manager_id=manager.id,
        is_active=False,
    )
    other_report = Employee(
        email="other.report@example.com",
        full_name="Other Report",
        manager_id=other_manager.id,
    )
    db.add_all([direct_report, inactive_report, other_report])
    db.commit()

    results = list_direct_reports(db, manager)

    assert [employee.email for employee in results] == ["report@example.com"]
