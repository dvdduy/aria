from pydantic import BaseModel, EmailStr


class EmployeeProfileResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    department: str | None
    role: str | None
    manager_id: str | None
    is_active: bool
