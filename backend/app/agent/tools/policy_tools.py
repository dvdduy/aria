"""Policy agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext


def get_policy(db: Session, context: ToolContext, **kwargs) -> dict:
    return {
        "error": "not_implemented",
        "tool": "get_policy",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
