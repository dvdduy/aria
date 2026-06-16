"""Notification agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import not_implemented


def send_notification(db: Session, context: ToolContext, **kwargs) -> dict:
    return not_implemented("send_notification")
