from datetime import date

from pydantic import BaseModel


class PolicyCategoriesResponse(BaseModel):
    categories: list[str]


class PolicySummaryResponse(BaseModel):
    id: str
    title: str
    category: str
    version: str
    effective_date: date | None
