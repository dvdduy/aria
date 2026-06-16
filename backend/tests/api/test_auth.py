from app.core.security import create_access_token, hash_password
from app.models.user import User


def test_register_endpoint_returns_token(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "employee@example.com",
            "password": "correct-password",
            "full_name": "Example Employee",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_register_endpoint_rejects_duplicate_email(client):
    payload = {
        "email": "employee@example.com",
        "password": "correct-password",
        "full_name": "Example Employee",
    }

    first = client.post("/api/auth/register", json=payload)
    second = client.post("/api/auth/register", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Email is already registered"


def test_login_endpoint_returns_token_after_registration(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "employee@example.com",
            "password": "correct-password",
            "full_name": "Example Employee",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "employee@example.com", "password": "correct-password"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_endpoint_rejects_invalid_password(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "employee@example.com",
            "password": "correct-password",
            "full_name": "Example Employee",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "employee@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_me_endpoint_returns_current_user_for_active_token(client):
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "employee@example.com",
            "password": "correct-password",
            "full_name": "Example Employee",
        },
    )
    token = register_response.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "employee@example.com"
    assert body["is_active"] is True
    assert body["is_admin"] is False


def test_me_endpoint_rejects_inactive_user_token(client, db):
    inactive_user = User(
        email="inactive@example.com",
        hashed_password=hash_password("correct-password"),
        is_active=False,
    )
    db.add(inactive_user)
    db.commit()
    db.refresh(inactive_user)
    token = create_access_token(str(inactive_user.id), is_admin=inactive_user.is_admin)

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Inactive user"


def test_admin_check_allows_admin_user(client, db):
    admin_user = User(
        email="admin@example.com",
        hashed_password=hash_password("correct-password"),
        is_admin=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    token = create_access_token(str(admin_user.id), is_admin=admin_user.is_admin)

    response = client.get(
        "/api/auth/admin-check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "email": "admin@example.com",
    }


def test_admin_check_blocks_non_admin_user(client, db):
    user = User(
        email="employee@example.com",
        hashed_password=hash_password("correct-password"),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/auth/admin-check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
