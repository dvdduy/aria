from datetime import date
from decimal import Decimal

from app.core.security import create_access_token, hash_password
from app.models.employee import Employee
from app.models.payroll import PayrollRecord
from app.models.user import User


def test_get_my_payroll_returns_records_for_linked_employee(client, db):
    employee = Employee(email="emp@example.com", full_name="Test Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    record = PayrollRecord(
        employee_id=employee.id,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        gross_salary=Decimal("5000.00"),
        net_salary=Decimal("4000.00"),
        currency="CAD",
    )
    db.add(record)

    user = User(
        email="emp@example.com",
        hashed_password=hash_password("password"),
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    response = client.get("/api/payroll/mine", headers=_auth_headers(user))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["gross_salary"] == 5000.0
    assert body[0]["net_salary"] == 4000.0
    assert body[0]["currency"] == "CAD"
    assert body[0]["period_start"] == "2026-01-01"
    assert body[0]["period_end"] == "2026-01-31"


def test_get_my_payroll_returns_404_when_no_employee_link(client, db):
    user = User(email="nolink@example.com", hashed_password=hash_password("password"))
    db.add(user)
    db.commit()
    db.refresh(user)

    response = client.get("/api/payroll/mine", headers=_auth_headers(user))

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not found"


def test_get_my_payroll_requires_authentication(client):
    response = client.get("/api/payroll/mine")

    assert response.status_code == 403


def test_get_employee_payroll_allows_admin(client, db):
    employee = Employee(email="emp@example.com", full_name="Test Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    record = PayrollRecord(
        employee_id=employee.id,
        period_start=date(2026, 3, 1),
        period_end=date(2026, 3, 31),
        gross_salary=Decimal("6000.00"),
        net_salary=Decimal("4800.00"),
        currency="CAD",
    )
    db.add(record)

    admin = User(
        email="admin@example.com",
        hashed_password=hash_password("password"),
        is_admin=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    response = client.get(
        f"/api/payroll/employee/{employee.id}",
        headers=_auth_headers(admin),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["gross_salary"] == 6000.0
    assert body[0]["employee_id"] == str(employee.id)


def test_get_employee_payroll_blocks_non_admin(client, db):
    employee = Employee(email="emp@example.com", full_name="Test Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(email="user@example.com", hashed_password=hash_password("password"))
    db.add(user)
    db.commit()
    db.refresh(user)

    response = client.get(
        f"/api/payroll/employee/{employee.id}",
        headers=_auth_headers(user),
    )

    assert response.status_code == 403


def test_get_employee_payroll_returns_404_for_unknown_employee(client, db):
    admin = User(
        email="admin@example.com",
        hashed_password=hash_password("password"),
        is_admin=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    import uuid
    response = client.get(
        f"/api/payroll/employee/{uuid.uuid4()}",
        headers=_auth_headers(admin),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee not found"


def test_get_employee_payroll_requires_authentication(client, db):
    employee = Employee(email="emp@example.com", full_name="Test Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    response = client.get(f"/api/payroll/employee/{employee.id}")

    assert response.status_code == 403


def _auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"Authorization": f"Bearer {token}"}
