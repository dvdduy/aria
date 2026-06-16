import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base
from app.core.types import GUID


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    employee_id = Column(GUID(), ForeignKey("employees.id"), nullable=False)
    leave_type = Column(String(50), nullable=False)   # annual | sick | parental | unpaid
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Integer, nullable=False)
    # pending | approved | rejected | cancelled
    status = Column(String(20), default="pending", nullable=False)
    reason = Column(Text, nullable=True)
    approved_by = Column(GUID(), ForeignKey("employees.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
