import uuid
from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    leave_type = Column(String(50), nullable=False)   # annual | sick | parental | unpaid
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Integer, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending | approved | rejected | cancelled
    reason = Column(Text, nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
