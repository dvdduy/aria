import uuid
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Text, func

from app.core.database import Base
from app.core.types import GUID


class Notification(Base):
    __tablename__ = "notifications"

    id: Any = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Any = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    message: Any = Column(Text, nullable=False)
    is_read: Any = Column(Boolean, default=False, nullable=False)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
