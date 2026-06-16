import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func

from app.core.database import Base
from app.core.types import GUID


class AgentMemory(Base):
    __tablename__ = "agent_memory"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(GUID(), nullable=False, index=True)
    role = Column(String(20), nullable=False)   # user | assistant | tool_result
    content = Column(Text, nullable=False)
    tool_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
