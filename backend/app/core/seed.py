from datetime import date, datetime, timezone
import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.user import User


def seed_dev_data(db: Session):
    # Idempotency check: skip if employees are already seeded
    if db.query(Employee).filter(Employee.email == "admin@aria.dev").first():
        print("Dev data already seeded, skipping")
        return

    # ── Employees ──────────────────────────────────────────────────────────
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
    db.flush()  # flush so manager_emp.id is available for the FK below

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

    # ── Users (create or link to employees) ────────────────────────────────
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

    # ── Sample leave requests ──────────────────────────────────────────────
    db.add_all([
        # Staff's pending request (manager can approve/reject)
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
        # Staff's approved request
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
        # Manager's own pending request (approved by nobody yet)
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
    print("Dev seed data created: 3 employees, 3 users, 3 leave requests")
