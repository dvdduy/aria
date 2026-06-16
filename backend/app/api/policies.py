from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.policy import HRPolicy
from app.models.user import User
from app.schemas.policy import PolicyCategoriesResponse, PolicySummaryResponse
from app.services.policy_service import list_policy_categories, search_policies

router = APIRouter()


def _serialize_policy_summary(policy: HRPolicy) -> dict:
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "version": policy.version,
        "effective_date": policy.effective_date,
    }


@router.get("/categories", response_model=PolicyCategoriesResponse)
def get_policy_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PolicyCategoriesResponse:
    return PolicyCategoriesResponse(categories=list_policy_categories(db))


@router.get("", response_model=list[PolicySummaryResponse])
def search_policy_summaries(
    query: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [_serialize_policy_summary(policy) for policy in search_policies(db, query)]
