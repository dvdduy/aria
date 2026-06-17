import uuid
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func

from app.core.database import Base
from app.core.types import GUID


class User(Base):
    __tablename__ = "users"

    id: Any = Column(GUID(), primary_key=True, default=uuid.uuid4)
    employee_id: Any = Column(GUID(), ForeignKey("employees.id"), unique=True, nullable=True)
    email: Any = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Any = Column(String, nullable=False)
    is_admin: Any = Column(Boolean, default=False, nullable=False)
    is_active: Any = Column(Boolean, default=True, nullable=False)
    last_login: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
