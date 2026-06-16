"""Payroll agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext


def get_payroll_summary(db: Session, context: ToolContext, **kwargs) -> dict:
    return {
        "error": "not_implemented",
        "tool": "get_payroll_summary",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
