import uuid
from sqlalchemy import Column, String, Boolean, Text, Date, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class HRPolicy(Base):
    __tablename__ = "hr_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # leave | payroll | conduct | onboarding
    content = Column(Text, nullable=False)
    version = Column(String(20), nullable=False, default="v1.0")
    effective_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())