from datetime import date, datetime

from pydantic import BaseModel


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
