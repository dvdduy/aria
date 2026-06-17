import uuid
from typing import Any

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, func

from app.core.database import Base
from app.core.types import GUID


class Employee(Base):
    __tablename__ = "employees"

    id: Any = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email: Any = Column(String(255), unique=True, nullable=False, index=True)
    full_name: Any = Column(String(255), nullable=False)
    department: Any = Column(String(100), nullable=True)
    role: Any = Column(String(100), nullable=True)
    manager_id: Any = Column(GUID(), ForeignKey("employees.id"), nullable=True)
    start_date: Any = Column(Date, nullable=True)
    is_active: Any = Column(Boolean, default=True, nullable=False)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
