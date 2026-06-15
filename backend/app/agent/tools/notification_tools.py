"""Notification agent tools."""

from sqlalchemy.orm import Session


def send_notification(db: Session, **kwargs) -> dict:
    return {
        "error": "not_implemented",
        "tool": "send_notification",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
