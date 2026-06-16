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
