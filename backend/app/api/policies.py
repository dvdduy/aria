from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.policy import HRPolicy
from app.models.user import User
from app.schemas.policy import (
    PolicyCategoriesResponse,
    PolicyDetailResponse,
    PolicySummaryResponse,
    PolicyWriteRequest,
)
from app.services.policy_service import (
    create_policy,
    deactivate_policy,
    get_policy,
    list_policy_categories,
    search_policies,
    update_policy,
)

router = APIRouter()


def _serialize_summary(policy: HRPolicy) -> dict:
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "version": policy.version,
        "effective_date": policy.effective_date,
    }


def _serialize_detail(policy: HRPolicy) -> dict:
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "content": policy.content,
        "version": policy.version,
        "effective_date": policy.effective_date,
        "is_active": policy.is_active,
    }


def _get_or_404(db: Session, policy_id: str) -> HRPolicy:
    policy = get_policy(db, policy_id)
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    return policy


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
    return [_serialize_summary(p) for p in search_policies(db, query)]


@router.get("/{policy_id}", response_model=PolicyDetailResponse)
def get_policy_detail(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return _serialize_detail(_get_or_404(db, policy_id))


@router.post("", response_model=PolicyDetailResponse, status_code=status.HTTP_201_CREATED)
def create_new_policy(
    body: PolicyWriteRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return _serialize_detail(create_policy(db, body))


@router.put("/{policy_id}", response_model=PolicyDetailResponse)
def update_existing_policy(
    policy_id: str,
    body: PolicyWriteRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    policy = _get_or_404(db, policy_id)
    return _serialize_detail(update_policy(db, policy, body))


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(
    policy_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    policy = _get_or_404(db, policy_id)
    deactivate_policy(db, policy)
