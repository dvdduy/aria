"""Leave agent tools.

These explicit stubs keep the tool catalog importable while leave workflow
business logic and authorization checks are built.
"""

from sqlalchemy.orm import Session


def _not_implemented(tool_name: str) -> dict:
    return {
        "error": "not_implemented",
        "tool": tool_name,
        "message": "This agent tool is scaffolded but not implemented yet.",
    }


def get_leave_request(db: Session, **kwargs) -> dict:
    return _not_implemented("get_leave_request")


def submit_leave_request(db: Session, **kwargs) -> dict:
    return _not_implemented("submit_leave_request")


def update_leave_status(db: Session, **kwargs) -> dict:
    return _not_implemented("update_leave_status")


def list_team_leave(db: Session, **kwargs) -> dict:
    return _not_implemented("list_team_leave")
