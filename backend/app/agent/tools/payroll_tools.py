"""Payroll agent tools."""

from sqlalchemy.orm import Session


def get_payroll_summary(db: Session, **kwargs) -> dict:
    return {
        "error": "not_implemented",
        "tool": "get_payroll_summary",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
