"""Payroll agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import profile_not_linked
from app.models.payroll import PayrollRecord
from app.services.payroll_service import list_payroll_records_for_employee


def get_payroll_summary(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("get_payroll_summary")

    return {
        "tool": "get_payroll_summary",
        "payroll_records": [
            _serialize_payroll_record(record)
            for record in list_payroll_records_for_employee(db, context.employee)
        ],
    }


def _serialize_payroll_record(record: PayrollRecord) -> dict:
    return {
        "id": str(record.id),
        "employee_id": str(record.employee_id),
        "period_start": record.period_start.isoformat(),
        "period_end": record.period_end.isoformat(),
        "gross_salary": str(record.gross_salary),
        "net_salary": str(record.net_salary),
        "currency": record.currency,
    }
