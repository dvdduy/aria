"""Policy agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import not_implemented


def get_policy(db: Session, context: ToolContext, **kwargs) -> dict:
    return not_implemented("get_policy")
