from sqlalchemy import or_, select
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


def search_policies(db: Session, query: str | None = None) -> list[HRPolicy]:
    statement = select(HRPolicy).where(HRPolicy.is_active.is_(True))

    normalized_query = query.strip() if query else ""
    if normalized_query:
        pattern = f"%{normalized_query}%"
        statement = statement.where(
            or_(
                HRPolicy.title.ilike(pattern),
                HRPolicy.category.ilike(pattern),
            )
        )

    statement = statement.order_by(HRPolicy.category.asc(), HRPolicy.title.asc())
    return list(db.execute(statement).scalars())
