from datetime import date

from app.agent.tools.context import ToolContext
from app.agent.tools.policy_tools import get_policy
from app.models.employee import Employee
from app.models.policy import HRPolicy
from app.models.user import User


def _tool_context(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return ToolContext(user=user, employee=employee, is_admin=False)


def test_get_policy_returns_stored_policy_by_category(db):
    policy = HRPolicy(
        title="Annual Leave Policy",
        category="leave",
        content="Employees receive annual leave according to plan rules.",
        version="v2.0",
        effective_date=date(2026, 1, 1),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    result = get_policy(db, _tool_context(db), category="leave")

    assert result["tool"] == "get_policy"
    assert result["policy"] == {
        "id": str(policy.id),
        "title": "Annual Leave Policy",
        "category": "leave",
        "content": "Employees receive annual leave according to plan rules.",
        "version": "v2.0",
        "effective_date": "2026-01-01",
    }
    assert result["source"] == {
        "policy_id": str(policy.id),
        "title": "Annual Leave Policy",
        "version": "v2.0",
        "effective_date": "2026-01-01",
    }
    assert result["answer_guidance"] == (
        "Use only the policy content above and cite Annual Leave Policy v2.0."
    )


def test_get_policy_source_metadata_handles_missing_effective_date(db):
    policy = HRPolicy(
        title="Annual Leave Policy",
        category="leave",
        content="Employees receive annual leave according to plan rules.",
    )
    db.add(policy)
    db.commit()

    result = get_policy(db, _tool_context(db), category="leave")

    assert result["source"]["effective_date"] is None
    assert result["answer_guidance"] == (
        "Use only the policy content above and cite Annual Leave Policy v1.0."
    )


def test_get_policy_returns_stored_policy_by_keyword(db):
    db.add_all(
        [
            HRPolicy(
                title="Annual Leave Policy",
                category="leave",
                content="Employees receive annual leave according to plan rules.",
            ),
            HRPolicy(
                title="Payroll Overview",
                category="payroll",
                content="Payroll policy content.",
            ),
        ]
    )
    db.commit()

    result = get_policy(db, _tool_context(db), keyword="annual")

    assert result["policy"]["title"] == "Annual Leave Policy"


def test_get_policy_searches_policy_content(db):
    db.add(
        HRPolicy(
            title="Annual Leave Policy",
            category="leave",
            content="Unused vacation carryover is handled by HR.",
        )
    )
    db.commit()

    result = get_policy(db, _tool_context(db), keyword="carryover")

    assert result["policy"]["content"] == "Unused vacation carryover is handled by HR."


def test_get_policy_ignores_inactive_policies(db):
    db.add(
        HRPolicy(
            title="Old Leave Policy",
            category="leave",
            content="Old inactive policy content.",
            is_active=False,
        )
    )
    db.commit()

    result = get_policy(db, _tool_context(db), category="leave")

    assert result == {
        "error": "not_found",
        "tool": "get_policy",
        "message": "No matching policy was found.",
    }


def test_get_policy_requires_category_or_keyword(db):
    result = get_policy(db, _tool_context(db))

    assert result == {
        "error": "invalid_request",
        "tool": "get_policy",
        "message": "Provide a policy category or keyword.",
    }


def test_get_policy_returns_not_found_without_matches(db):
    db.add(
        HRPolicy(
            title="Annual Leave Policy",
            category="leave",
            content="Leave policy content.",
        )
    )
    db.commit()

    result = get_policy(db, _tool_context(db), keyword="missing")

    assert result == {
        "error": "not_found",
        "tool": "get_policy",
        "message": "No matching policy was found.",
    }
