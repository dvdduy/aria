import uuid
from typing import Any

from sqlalchemy import Boolean, Column, Date, DateTime, String, Text, func

from app.core.database import Base
from app.core.types import GUID


class HRPolicy(Base):
    __tablename__ = "hr_policies"

    id: Any = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title: Any = Column(String(255), nullable=False)
    category: Any = Column(String(100), nullable=False)  # leave | payroll | conduct | onboarding
    content: Any = Column(Text, nullable=False)
    version: Any = Column(String(20), nullable=False, default="v1.0")
    effective_date: Any = Column(Date, nullable=True)
    is_active: Any = Column(Boolean, default=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
