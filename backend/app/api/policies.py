from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.policy import PolicyCategoriesResponse
from app.services.policy_service import list_policy_categories

router = APIRouter()


@router.get("/categories", response_model=PolicyCategoriesResponse)
def get_policy_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PolicyCategoriesResponse:
    return PolicyCategoriesResponse(categories=list_policy_categories(db))
