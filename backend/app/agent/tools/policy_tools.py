"""Policy agent tools."""

from sqlalchemy.orm import Session


def get_policy(db: Session, **kwargs) -> dict:
    return {
        "error": "not_implemented",
        "tool": "get_policy",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
