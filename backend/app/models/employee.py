import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, func

from app.core.database import Base
from app.core.types import GUID


class Employee(Base):
    __tablename__ = "employees"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    role = Column(String(100), nullable=True)
    manager_id = Column(GUID(), ForeignKey("employees.id"), nullable=True)
    start_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
