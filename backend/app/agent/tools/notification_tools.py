"""Notification agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext


def send_notification(db: Session, context: ToolContext, **kwargs) -> dict:
    return {
        "error": "not_implemented",
        "tool": "send_notification",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
