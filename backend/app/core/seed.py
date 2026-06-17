from datetime import date, datetime, timezone
import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.payroll import PayrollRecord
from app.models.user import User


def seed_dev_data(db: Session):
    employees_exist = db.query(Employee).filter(Employee.email == "admin@aria.dev").first()
    if not employees_exist:
        _seed_employees_and_leave(db)

    _seed_payroll_if_missing(db)


def _seed_employees_and_leave(db: Session):
    admin_emp = Employee(
        id=uuid.uuid4(),
        email="admin@aria.dev",
        full_name="Alex Admin",
        department="HR",
        role="HR Administrator",
        start_date=date(2021, 1, 15),
    )
    manager_emp = Employee(
        id=uuid.uuid4(),
        email="manager@aria.dev",
        full_name="Morgan Manager",
        department="Engineering",
        role="Engineering Manager",
        start_date=date(2021, 3, 1),
    )
    db.add_all([admin_emp, manager_emp])
    db.flush()

    staff_emp = Employee(
        id=uuid.uuid4(),
        email="employee@aria.dev",
        full_name="Sam Staff",
        department="Engineering",
        role="Software Engineer",
        manager_id=manager_emp.id,
        start_date=date(2023, 6, 12),
    )
    db.add(staff_emp)
    db.flush()

    for email, password, is_admin, emp in [
        ("admin@aria.dev",    "admin123",    True,  admin_emp),
        ("manager@aria.dev",  "manager123",  False, manager_emp),
        ("employee@aria.dev", "employee123", False, staff_emp),
    ]:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.employee_id = emp.id
        else:
            db.add(User(
                email=email,
                hashed_password=hash_password(password),
                is_admin=is_admin,
                is_active=True,
                employee_id=emp.id,
            ))

    db.add_all([
        LeaveRequest(
            id=uuid.uuid4(),
            employee_id=staff_emp.id,
            leave_type="annual",
            start_date=date(2026, 7, 14),
            end_date=date(2026, 7, 18),
            days_requested=5,
            status="pending",
            reason="Summer holiday",
        ),
        LeaveRequest(
            id=uuid.uuid4(),
            employee_id=staff_emp.id,
            leave_type="sick",
            start_date=date(2026, 5, 6),
            end_date=date(2026, 5, 7),
            days_requested=2,
            status="approved",
            reason="Flu",
            approved_by=manager_emp.id,
            approved_at=datetime(2026, 5, 5, 9, 0, tzinfo=timezone.utc),
        ),
        LeaveRequest(
            id=uuid.uuid4(),
            employee_id=manager_emp.id,
            leave_type="annual",
            start_date=date(2026, 8, 4),
            end_date=date(2026, 8, 8),
            days_requested=5,
            status="pending",
            reason="Family trip",
        ),
    ])

    db.commit()
    print("Dev seed: 3 employees, 3 users, 3 leave requests")


def _seed_payroll_if_missing(db: Session):
    if db.query(PayrollRecord).first():
        return

    employees = {
        e.email: e
        for e in db.query(Employee).filter(
            Employee.email.in_(["admin@aria.dev", "manager@aria.dev", "employee@aria.dev"])
        ).all()
    }
    if len(employees) < 3:
        return

    periods = [
        (date(2026, 3, 1), date(2026, 3, 31)),
        (date(2026, 4, 1), date(2026, 4, 30)),
        (date(2026, 5, 1), date(2026, 5, 31)),
        (date(2026, 6, 1), date(2026, 6, 30)),
    ]
    payroll_data = [
        (employees["employee@aria.dev"], Decimal("7800.00"),  Decimal("5460.00")),
        (employees["manager@aria.dev"],  Decimal("12500.00"), Decimal("8500.00")),
        (employees["admin@aria.dev"],    Decimal("9200.00"),  Decimal("6440.00")),
    ]
    for emp, gross, net in payroll_data:
        for period_start, period_end in periods:
            db.add(PayrollRecord(
                id=uuid.uuid4(),
                employee_id=emp.id,
                period_start=period_start,
                period_end=period_end,
                gross_salary=gross,
                net_salary=net,
                currency="CAD",
            ))

    db.commit()
    print("Dev seed: 12 payroll records")
