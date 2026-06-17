import json
import uuid

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import build_tool_trace_step, dispatch_tool
from app.agent.tools.context import build_tool_context
from app.agent.tools.definitions import TOOL_DEFINITIONS
from app.core.config import settings
from app.core.logging import logger
from app.models.user import User


class AgentRunner:
    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    def run(self, message: str, session_id: str, user_id: str, db: Session) -> dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {
                "message": "I could not verify your account for this request.",
                "tool_trace": [],
            }

        tool_context = build_tool_context(db, user)
        tool_trace: list[dict] = []
        history = self._load_history(session_id, user_id, db)
        history.append({"role": "user", "content": message})
        self._save_to_memory(session_id, user_id, "user", message, db)

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
                return {"message": final_text, "tool_trace": tool_trace}

            if response.stop_reason == "tool_use":
                content_blocks = [self._block_to_dict(b) for b in response.content]
                history.append({"role": "assistant", "content": response.content})
                self._save_to_memory(session_id, user_id, "assistant", content_blocks, db)

                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = dispatch_tool(block.name, block.input, db, tool_context)
                        tool_trace.append(build_tool_trace_step(block.name, result))
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result),
                        })
                history.append({"role": "user", "content": tool_results})
                self._save_to_memory(session_id, user_id, "user", tool_results, db)

        return {
            "message": (
                "I was unable to complete this task within the allowed steps. "
                "Please try a simpler request."
            ),
            "tool_trace": tool_trace,
        }

    def _block_to_dict(self, block) -> dict:
        if block.type == "tool_use":
            return {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}
        if block.type == "text":
            return {"type": "text", "text": block.text}
        return {"type": block.type}

    def _load_history(self, session_id: str, user_id: str, db: Session) -> list:
        from app.models.agent_memory import AgentMemory
        records = (
            db.query(AgentMemory)
            .filter_by(session_id=session_id, user_id=user_id)
            .order_by(AgentMemory.created_at)
            .limit(40)
            .all()
        )
        history = []
        for r in records:
            try:
                content = json.loads(r.content)
            except (json.JSONDecodeError, ValueError):
                content = r.content
            history.append({"role": r.role, "content": content})
        return history

    def _save_to_memory(self, session_id: str, user_id: str, role: str, content, db: Session):
        from app.models.agent_memory import AgentMemory
        if isinstance(content, list | dict):
            content_str = json.dumps(content)
        else:
            content_str = content
        db.add(
            AgentMemory(
                user_id=user_id,
                session_id=uuid.UUID(session_id) if isinstance(session_id, str) else session_id,
                role=role,
                content=content_str,
            )
        )
        db.commit()
