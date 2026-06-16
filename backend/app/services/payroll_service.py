from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.payroll import PayrollRecord


def list_payroll_records_for_employee(
    db: Session,
    employee: Employee,
) -> list[PayrollRecord]:
    return (
        db.query(PayrollRecord)
        .filter(PayrollRecord.employee_id == employee.id)
        .order_by(PayrollRecord.period_start.desc())
        .all()
    )
