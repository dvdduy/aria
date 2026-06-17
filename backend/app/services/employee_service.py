import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreateRequest, EmployeeUpdateRequest


def get_employee_for_user(db: Session, user: User) -> Employee | None:
    if not user.employee_id:
        return None
    return db.query(Employee).filter(Employee.id == user.employee_id).first()


def list_direct_reports(db: Session, manager: Employee) -> list[Employee]:
    return (
        db.query(Employee)
        .filter(Employee.manager_id == manager.id, Employee.is_active.is_(True))
        .order_by(Employee.full_name)
        .all()
    )


def can_manage_employee(manager: Employee, employee: Employee) -> bool:
    if not employee.manager_id:
        return False
    return employee.manager_id == manager.id


def list_all_employees(db: Session) -> list[Employee]:
    return (
        db.query(Employee)
        .order_by(Employee.full_name)
        .all()
    )


def get_employee_by_id(db: Session, employee_id: str) -> Employee | None:
    return db.query(Employee).filter(Employee.id == employee_id).first()


def create_employee_with_user(db: Session, data: EmployeeCreateRequest) -> Employee:
    employee = Employee(
        id=uuid.uuid4(),
        email=data.email,
        full_name=data.full_name,
        role=data.role,
        department=data.department,
        manager_id=uuid.UUID(data.manager_id) if data.manager_id else None,
        start_date=data.start_date,
        is_active=True,
    )
    db.add(employee)
    db.flush()

    user = User(
        id=uuid.uuid4(),
        email=data.email,
        hashed_password=hash_password(data.temp_password),
        is_admin=False,
        is_active=True,
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(employee)
    return employee


def update_employee(db: Session, employee: Employee, data: EmployeeUpdateRequest) -> Employee:
    employee.full_name = data.full_name
    employee.role = data.role
    employee.department = data.department
    employee.manager_id = uuid.UUID(data.manager_id) if data.manager_id else None
    employee.start_date = data.start_date
    db.commit()
    db.refresh(employee)
    return employee


def deactivate_employee(db: Session, employee: Employee) -> Employee:
    employee.is_active = False
    user = db.query(User).filter(User.employee_id == employee.id).first()
    if user:
        user.is_active = False
    db.commit()
    db.refresh(employee)
    return employee


def reactivate_employee(db: Session, employee: Employee) -> Employee:
    employee.is_active = True
    user = db.query(User).filter(User.employee_id == employee.id).first()
    if user:
        user.is_active = True
    db.commit()
    db.refresh(employee)
    return employee
