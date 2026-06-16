from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import dispatch_tool
from app.agent.tools.context import build_tool_context
from app.agent.tools.definitions import TOOL_DEFINITIONS
from app.core.config import settings
from app.core.logging import logger
from app.models.user import User


class AgentRunner:
    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    def run(self, message: str, session_id: str, user_id: str, db: Session) -> str:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return "I could not verify your account for this request."

        tool_context = build_tool_context(db, user)
        history = self._load_history(session_id, user_id, db)
        history.append({"role": "user", "content": message})

        for iteration in range(settings.agent_max_iterations):
            response = self.client.messages.create(
                model=settings.llm_model,
                max_tokens=settings.llm_max_tokens,
                system=SYSTEM_PROMPT,
                tools=TOOL_DEFINITIONS,
                messages=history,
            )

            if response.stop_reason == "end_turn":
                final_text = next(
                    (b.text for b in response.content if hasattr(b, "text")), ""
                )
                self._save_to_memory(session_id, user_id, "assistant", final_text, db)
                logger.info("agent_done", session_id=session_id, iterations=iteration + 1)
                return final_text

            if response.stop_reason == "tool_use":
                history.append({"role": "assistant", "content": response.content})
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = dispatch_tool(block.name, block.input, db, tool_context)
                        logger.info("tool_called", tool=block.name, session_id=session_id)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result),
                        })
                history.append({"role": "user", "content": tool_results})

        return (
            "I was unable to complete this task within the allowed steps. "
            "Please try a simpler request."
        )

    def _load_history(self, session_id: str, user_id: str, db: Session) -> list:
        from app.models.agent_memory import AgentMemory
        records = (
            db.query(AgentMemory)
            .filter_by(session_id=session_id, user_id=user_id)
            .order_by(AgentMemory.created_at)
            .limit(40)
            .all()
        )
        return [{"role": r.role, "content": r.content} for r in records]

    def _save_to_memory(self, session_id: str, user_id: str, role: str, content: str, db: Session):
        import uuid

        from app.models.agent_memory import AgentMemory
        db.add(
            AgentMemory(
                user_id=user_id,
                session_id=uuid.UUID(session_id) if isinstance(session_id, str) else session_id,
                role=role,
                content=content,
            )
        )
        db.commit()
