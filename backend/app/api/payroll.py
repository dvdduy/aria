from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.services.employee_service import get_employee_by_id, get_employee_for_user
from app.services.payroll_service import list_payroll_records_for_employee

router = APIRouter()


def _serialize(record) -> dict:
    return {
        "id": str(record.id),
        "employee_id": str(record.employee_id),
        "period_start": record.period_start.isoformat(),
        "period_end": record.period_end.isoformat(),
        "gross_salary": float(record.gross_salary),
        "net_salary": float(record.net_salary),
        "currency": record.currency,
    }


@router.get("/mine")
def get_my_payroll(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )
    records = list_payroll_records_for_employee(db, employee)
    return [_serialize(r) for r in records]


@router.get("/employee/{employee_id}")
def get_employee_payroll(
    employee_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    records = list_payroll_records_for_employee(db, employee)
    return [_serialize(r) for r in records]
