from app.core.security import create_access_token, hash_password
from app.models.employee import Employee
from app.models.user import User


def test_get_my_employee_profile_returns_linked_employee(client, db):
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
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/employees/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "employee@example.com"
    assert body["full_name"] == "Example Employee"
    assert body["department"] == "People Operations"
    assert body["role"] == "HR Specialist"
    assert body["manager_id"] is None
    assert body["is_active"] is True


def test_get_my_employee_profile_returns_404_when_not_linked(client, db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/employees/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"


def test_get_my_direct_reports_returns_current_managers_active_reports(client, db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    other_manager = Employee(email="other.manager@example.com", full_name="Other Manager")
    db.add_all([manager, other_manager])
    db.commit()
    db.refresh(manager)
    db.refresh(other_manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        department="People Operations",
        role="HR Specialist",
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

    user = User(
        email="manager@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=manager.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/employees/direct-reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["email"] == "report@example.com"
    assert body[0]["full_name"] == "Direct Report"
    assert body[0]["department"] == "People Operations"
    assert body[0]["role"] == "HR Specialist"
    assert body[0]["manager_id"] == str(manager.id)
    assert body[0]["is_active"] is True


def test_get_my_direct_reports_returns_404_when_user_has_no_employee_link(client, db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/employees/direct-reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"
