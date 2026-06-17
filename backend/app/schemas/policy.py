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


class PolicyDetailResponse(BaseModel):
    id: str
    title: str
    category: str
    content: str
    version: str
    effective_date: date | None
    is_active: bool


class PolicyWriteRequest(BaseModel):
    title: str
    category: str
    content: str
    version: str = "v1.0"
    effective_date: date | None = None
