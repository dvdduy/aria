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
