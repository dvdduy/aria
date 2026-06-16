import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, func

from app.core.database import Base
from app.core.types import GUID


class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    employee_id = Column(GUID(), ForeignKey("employees.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    gross_salary = Column(Numeric(12, 2), nullable=False)
    net_salary = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="CAD", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
