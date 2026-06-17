import uuid
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func

from app.core.database import Base
from app.core.types import GUID


class AgentMemory(Base):
    __tablename__ = "agent_memory"

    id: Any = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Any = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    session_id: Any = Column(GUID(), nullable=False, index=True)
    role: Any = Column(String(20), nullable=False)   # user | assistant | tool_result
    content: Any = Column(Text, nullable=False)
    tool_name: Any = Column(String(100), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
