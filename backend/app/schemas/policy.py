from pydantic import BaseModel


class PolicyCategoriesResponse(BaseModel):
    categories: list[str]
