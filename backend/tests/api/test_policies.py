from datetime import date

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


def test_policy_search_requires_auth(client):
    response = client.get("/api/policies")

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


def test_policy_search_returns_active_policy_summaries_without_content(client, db):
    active = HRPolicy(
        title="Annual Leave Policy",
        category="leave",
        content="Full body should not be returned",
        version="v2.0",
        effective_date=date(2026, 1, 1),
    )
    inactive = HRPolicy(
        title="Old Leave Policy",
        category="leave",
        content="Old body",
        is_active=False,
    )
    db.add_all([active, inactive])
    db.commit()
    db.refresh(active)

    response = client.get("/api/policies", headers=_auth_headers_for_user(db))

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(active.id),
            "title": "Annual Leave Policy",
            "category": "leave",
            "version": "v2.0",
            "effective_date": "2026-01-01",
        }
    ]
    assert "content" not in response.json()[0]


def test_policy_search_matches_title_and_category(client, db):
    leave_policy = HRPolicy(
        title="Annual Leave Policy",
        category="leave",
        content="Leave body",
    )
    payroll_policy = HRPolicy(
        title="Compensation Overview",
        category="payroll",
        content="Payroll body",
    )
    conduct_policy = HRPolicy(
        title="Code of Conduct",
        category="conduct",
        content="Conduct body",
    )
    db.add_all([leave_policy, payroll_policy, conduct_policy])
    db.commit()
    headers = _auth_headers_for_user(db)

    title_response = client.get("/api/policies?query=annual", headers=headers)
    category_response = client.get("/api/policies?query=payroll", headers=headers)

    assert title_response.status_code == 200
    assert [policy["title"] for policy in title_response.json()] == [
        "Annual Leave Policy"
    ]
    assert category_response.status_code == 200
    assert [policy["title"] for policy in category_response.json()] == [
        "Compensation Overview"
    ]


def test_policy_search_is_case_insensitive(client, db):
    db.add(
        HRPolicy(
            title="Annual Leave Policy",
            category="leave",
            content="Leave body",
        )
    )
    db.commit()

    response = client.get(
        "/api/policies?query=LEAVE",
        headers=_auth_headers_for_user(db),
    )

    assert response.status_code == 200
    assert [policy["title"] for policy in response.json()] == ["Annual Leave Policy"]


def test_policy_search_returns_empty_list_without_matches(client, db):
    db.add(
        HRPolicy(
            title="Annual Leave Policy",
            category="leave",
            content="Leave body",
        )
    )
    db.commit()

    response = client.get(
        "/api/policies?query=missing",
        headers=_auth_headers_for_user(db),
    )

    assert response.status_code == 200
    assert response.json() == []
