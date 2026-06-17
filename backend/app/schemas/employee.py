from datetime import date

from pydantic import BaseModel, EmailStr


class EmployeeProfileResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    department: str | None
    role: str | None
    manager_id: str | None
    manager_name: str | None = None
    start_date: date | None
    is_active: bool


class EmployeeCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    role: str | None = None
    department: str | None = None
    manager_id: str | None = None
    start_date: date | None = None
    temp_password: str


class EmployeeUpdateRequest(BaseModel):
    full_name: str
    role: str | None = None
    department: str | None = None
    manager_id: str | None = None
    start_date: date | None = None
