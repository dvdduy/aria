from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class LeaveRequestCreate(BaseModel):
    leave_type: Literal["annual", "sick", "parental", "unpaid"]
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveRequestResponse(BaseModel):
    id: str
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    days_requested: int
    status: str
    reason: str | None
    approved_by: str | None
    approved_at: datetime | None
