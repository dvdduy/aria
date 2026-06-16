from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class LeaveRequestCreate(BaseModel):
    leave_type: Literal["annual", "sick", "parental", "unpaid"]
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveRequestReject(BaseModel):
    rejection_reason: str = Field(min_length=1)


class LeaveRequestResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str | None
    leave_type: str
    start_date: date
    end_date: date
    days_requested: int
    status: str
    reason: str | None
    approved_by: str | None
    approved_at: datetime | None
