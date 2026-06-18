from app.core.security import create_access_token, hash_password
from app.models.notification import Notification
from app.models.user import User


def test_get_my_notifications_returns_only_current_user_notifications(client, db):
    user = _create_user(db, "user@example.com")
    other = _create_user(db, "other@example.com")

    db.add_all([
        Notification(user_id=user.id, message="Your leave was approved"),
        Notification(user_id=user.id, message="Payroll processed"),
        Notification(user_id=other.id, message="Other user notification"),
    ])
    db.commit()

    response = client.get("/api/notifications", headers=_auth_headers(user))

    assert response.status_code == 200
    body = response.json()
    assert body["unread_count"] == 2
    messages = [n["message"] for n in body["notifications"]]
    assert "Your leave was approved" in messages
    assert "Payroll processed" in messages
    assert "Other user notification" not in messages


def test_get_my_notifications_counts_only_unread(client, db):
    user = _create_user(db, "user@example.com")

    db.add_all([
        Notification(user_id=user.id, message="Unread one", is_read=False),
        Notification(user_id=user.id, message="Already read", is_read=True),
    ])
    db.commit()

    response = client.get("/api/notifications", headers=_auth_headers(user))

    assert response.status_code == 200
    body = response.json()
    assert body["unread_count"] == 1
    assert len(body["notifications"]) == 2


def test_get_my_notifications_returns_empty_when_none(client, db):
    user = _create_user(db, "user@example.com")

    response = client.get("/api/notifications", headers=_auth_headers(user))

    assert response.status_code == 200
    assert response.json() == {"notifications": [], "unread_count": 0}


def test_get_my_notifications_requires_authentication(client):
    response = client.get("/api/notifications")

    assert response.status_code == 403


def test_mark_all_read_marks_only_current_user_notifications(client, db):
    user = _create_user(db, "user@example.com")
    other = _create_user(db, "other@example.com")

    n1 = Notification(user_id=user.id, message="Unread A", is_read=False)
    n2 = Notification(user_id=user.id, message="Unread B", is_read=False)
    n3 = Notification(user_id=other.id, message="Other unread", is_read=False)
    db.add_all([n1, n2, n3])
    db.commit()
    db.refresh(n3)

    response = client.post("/api/notifications/read-all", headers=_auth_headers(user))

    assert response.status_code == 200
    assert response.json()["marked_read"] == 2

    db.refresh(n3)
    assert n3.is_read is False


def test_mark_all_read_returns_zero_when_nothing_unread(client, db):
    user = _create_user(db, "user@example.com")

    db.add(Notification(user_id=user.id, message="Already read", is_read=True))
    db.commit()

    response = client.post("/api/notifications/read-all", headers=_auth_headers(user))

    assert response.status_code == 200
    assert response.json()["marked_read"] == 0


def test_mark_all_read_requires_authentication(client):
    response = client.post("/api/notifications/read-all")

    assert response.status_code == 403


def _create_user(db, email: str) -> User:
    user = User(email=email, hashed_password=hash_password("password"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"Authorization": f"Bearer {token}"}
