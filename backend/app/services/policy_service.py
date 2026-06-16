from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.policy import HRPolicy


def list_policy_categories(db: Session) -> list[str]:
    categories = db.execute(
        select(HRPolicy.category)
        .where(HRPolicy.is_active.is_(True))
        .distinct()
        .order_by(HRPolicy.category.asc())
    ).scalars()

    return list(categories)
