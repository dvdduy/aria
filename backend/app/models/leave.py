import uuid
from typing import Any

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base
from app.core.types import GUID


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Any = Column(GUID(), primary_key=True, default=uuid.uuid4)
    employee_id: Any = Column(GUID(), ForeignKey("employees.id"), nullable=False)
    leave_type: Any = Column(String(50), nullable=False)   # annual | sick | parental | unpaid
    start_date: Any = Column(Date, nullable=False)
    end_date: Any = Column(Date, nullable=False)
    days_requested: Any = Column(Integer, nullable=False)
    # pending | approved | rejected | cancelled
    status: Any = Column(String(20), default="pending", nullable=False)
    reason: Any = Column(Text, nullable=True)
    approved_by: Any = Column(GUID(), ForeignKey("employees.id"), nullable=True)
    approved_at: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
