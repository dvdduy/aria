"""Policy agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import invalid_request, not_found
from app.models.policy import HRPolicy
from app.services.policy_service import find_policy_for_agent


def get_policy(
    db: Session,
    context: ToolContext,
    category: str | None = None,
    keyword: str | None = None,
    **kwargs,
) -> dict:
    if not (category and category.strip()) and not (keyword and keyword.strip()):
        return invalid_request("get_policy", "Provide a policy category or keyword.")

    policy = find_policy_for_agent(db, category=category, keyword=keyword)
    if not policy:
        return not_found("get_policy", "No matching policy was found.")

    return {
        "tool": "get_policy",
        "policy": _serialize_policy(policy),
    }


def _serialize_policy(policy: HRPolicy) -> dict:
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "content": policy.content,
        "version": policy.version,
        "effective_date": (
            policy.effective_date.isoformat() if policy.effective_date else None
        ),
    }
