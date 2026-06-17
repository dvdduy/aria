from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.policy import HRPolicy
from app.schemas.policy import PolicyWriteRequest


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


def find_policy_for_agent(
    db: Session,
    category: str | None = None,
    keyword: str | None = None,
) -> HRPolicy | None:
    statement = select(HRPolicy).where(HRPolicy.is_active.is_(True))

    normalized_category = category.strip() if category else ""
    normalized_keyword = keyword.strip() if keyword else ""

    if normalized_category:
        statement = statement.where(HRPolicy.category.ilike(normalized_category))

    if normalized_keyword:
        pattern = f"%{normalized_keyword}%"
        statement = statement.where(
            or_(
                HRPolicy.title.ilike(pattern),
                HRPolicy.content.ilike(pattern),
                HRPolicy.category.ilike(pattern),
            )
        )

    statement = statement.order_by(HRPolicy.category.asc(), HRPolicy.title.asc())
    result = db.execute(statement).scalars().first()

    # If category filter returned nothing, retry with keyword-only fallback
    if result is None and normalized_category and not normalized_keyword:
        fallback = select(HRPolicy).where(HRPolicy.is_active.is_(True))
        pattern = f"%{normalized_category}%"
        fallback = fallback.where(
            or_(
                HRPolicy.title.ilike(pattern),
                HRPolicy.content.ilike(pattern),
            )
        )
        fallback = fallback.order_by(HRPolicy.category.asc(), HRPolicy.title.asc())
        result = db.execute(fallback).scalars().first()

    return result


def get_policy(db: Session, policy_id: str) -> HRPolicy | None:
    return db.query(HRPolicy).filter(HRPolicy.id == policy_id).first()


def create_policy(db: Session, data: PolicyWriteRequest) -> HRPolicy:
    policy = HRPolicy(
        title=data.title,
        category=data.category,
        content=data.content,
        version=data.version,
        effective_date=data.effective_date,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


def update_policy(db: Session, policy: HRPolicy, data: PolicyWriteRequest) -> HRPolicy:
    policy.title = data.title
    policy.category = data.category
    policy.content = data.content
    policy.version = data.version
    policy.effective_date = data.effective_date
    db.commit()
    db.refresh(policy)
    return policy


def deactivate_policy(db: Session, policy: HRPolicy) -> None:
    policy.is_active = False
    db.commit()
