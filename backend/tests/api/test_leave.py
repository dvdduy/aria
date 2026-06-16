from datetime import date

from app.core.security import create_access_token, hash_password
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.user import User


def test_get_my_leave_requests_returns_only_current_employee_requests(client, db):
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
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["employee_id"] == str(employee.id)
    assert body[0]["leave_type"] == "annual"
    assert body[0]["status"] == "pending"
    assert body[0]["reason"] == "Family vacation"


def test_get_my_leave_requests_returns_404_when_user_has_no_employee_link(client, db):
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
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"


def test_submit_my_leave_request_creates_pending_request(client, db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
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

    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Family vacation",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["employee_id"] == str(employee.id)
    assert body["leave_type"] == "annual"
    assert body["start_date"] == "2026-07-01"
    assert body["end_date"] == "2026-07-05"
    assert body["days_requested"] == 5
    assert body["status"] == "pending"
    assert body["reason"] == "Family vacation"


def test_submit_my_leave_request_returns_404_when_user_has_no_employee_link(client, db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Family vacation",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"


def test_submit_my_leave_request_rejects_invalid_date_range(client, db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
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

    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "annual",
            "start_date": "2026-07-05",
            "end_date": "2026-07-01",
            "reason": "Bad dates",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "End date must be on or after start date"


def test_submit_my_leave_request_rejects_unknown_leave_type(client, db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
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

    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "vacation",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Family vacation",
        },
    )

    assert response.status_code == 422
