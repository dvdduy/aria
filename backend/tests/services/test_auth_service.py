from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth_service import login_user, register_user


def test_register_user_creates_user_and_returns_token(db):
    result = register_user(
        db,
        RegisterRequest(
            email="employee@example.com",
            password="correct-password",
            full_name="Example Employee",
        ),
    )

    user = db.query(User).filter(User.email == "employee@example.com").one()
    assert result["token_type"] == "bearer"
    assert result["access_token"]
    assert user.hashed_password != "correct-password"


def test_login_user_returns_token_for_valid_credentials(db):
    register_user(
        db,
        RegisterRequest(
            email="employee@example.com",
            password="correct-password",
            full_name="Example Employee",
        ),
    )

    result = login_user(
        db,
        LoginRequest(email="employee@example.com", password="correct-password"),
    )

    assert result is not None
    assert result["token_type"] == "bearer"
    assert result["access_token"]


def test_login_user_returns_none_for_invalid_password(db):
    register_user(
        db,
        RegisterRequest(
            email="employee@example.com",
            password="correct-password",
            full_name="Example Employee",
        ),
    )

    result = login_user(
        db,
        LoginRequest(email="employee@example.com", password="wrong-password"),
    )

    assert result is None
