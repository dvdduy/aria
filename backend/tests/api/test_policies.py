from app.core.security import create_access_token, hash_password
from app.models.policy import HRPolicy
from app.models.user import User


def _auth_headers_for_user(db, email="policy.user@example.com"):
    user = User(
        email=email,
        hashed_password=hash_password("correct-password"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"Authorization": f"Bearer {token}"}


def test_policy_categories_requires_auth(client):
    response = client.get("/api/policies/categories")

    assert response.status_code == 403


def test_list_policy_categories_returns_unique_sorted_categories(client, db):
    db.add_all(
        [
            HRPolicy(
                title="Payroll Basics",
                category="payroll",
                content="Payroll content",
            ),
            HRPolicy(
                title="Leave Basics",
                category="leave",
                content="Leave content",
            ),
            HRPolicy(
                title="Leave Advanced",
                category="leave",
                content="More leave content",
            ),
        ]
    )
    db.commit()

    response = client.get(
        "/api/policies/categories",
        headers=_auth_headers_for_user(db),
    )

    assert response.status_code == 200
    assert response.json() == {"categories": ["leave", "payroll"]}


def test_list_policy_categories_ignores_inactive_policies(client, db):
    db.add(
        HRPolicy(
            title="Old Conduct",
            category="conduct",
            content="Old conduct content",
            is_active=False,
        )
    )
    db.commit()

    response = client.get(
        "/api/policies/categories",
        headers=_auth_headers_for_user(db),
    )

    assert response.status_code == 200
    assert response.json() == {"categories": []}


def test_list_policy_categories_returns_empty_list_without_policies(client, db):
    response = client.get(
        "/api/policies/categories",
        headers=_auth_headers_for_user(db),
    )

    assert response.status_code == 200
    assert response.json() == {"categories": []}
