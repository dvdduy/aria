import uuid
from sqlalchemy import Column, Date, DateTime, Numeric, String, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    gross_salary = Column(Numeric(12, 2), nullable=False)
    net_salary = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="CAD", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
