from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreateRequest,
    EmployeeProfileResponse,
    EmployeeUpdateRequest,
)
from app.services.employee_service import (
    create_employee_with_user,
    deactivate_employee,
    get_employee_by_id,
    get_employee_for_user,
    list_all_employees,
    list_direct_reports,
    reactivate_employee,
    update_employee,
)

router = APIRouter()


def _serialize_employee(employee: Employee) -> dict:
    return {
        "id": str(employee.id),
        "email": employee.email,
        "full_name": employee.full_name,
        "department": employee.department,
        "role": employee.role,
        "manager_id": str(employee.manager_id) if employee.manager_id else None,
        "start_date": employee.start_date.isoformat() if employee.start_date else None,
        "is_active": employee.is_active,
    }


def _get_or_404(db: Session, employee_id: str) -> Employee:
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return employee


@router.get("/me", response_model=EmployeeProfileResponse)
def get_my_employee_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return _serialize_employee(employee)


@router.get("/direct-reports", response_model=list[EmployeeProfileResponse])
def get_my_direct_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    manager = get_employee_for_user(db, current_user)
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return [_serialize_employee(e) for e in list_direct_reports(db, manager)]


@router.get("", response_model=list[EmployeeProfileResponse])
def get_all_employees(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return [_serialize_employee(e) for e in list_all_employees(db)]


@router.post("", response_model=EmployeeProfileResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    body: EmployeeCreateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(Employee).filter(Employee.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An employee with this email already exists.",
        )
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user account with this email already exists.",
        )
    return _serialize_employee(create_employee_with_user(db, body))


@router.put("/{employee_id}", response_model=EmployeeProfileResponse)
def update_employee_profile(
    employee_id: str,
    body: EmployeeUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = _get_or_404(db, employee_id)
    return _serialize_employee(update_employee(db, employee, body))


@router.post("/{employee_id}/deactivate", response_model=EmployeeProfileResponse)
def deactivate_employee_profile(
    employee_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = _get_or_404(db, employee_id)
    return _serialize_employee(deactivate_employee(db, employee))


@router.post("/{employee_id}/reactivate", response_model=EmployeeProfileResponse)
def reactivate_employee_profile(
    employee_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = _get_or_404(db, employee_id)
    return _serialize_employee(reactivate_employee(db, employee))
