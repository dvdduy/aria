from datetime import date, datetime, timezone
import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.payroll import PayrollRecord
from app.models.policy import HRPolicy
from app.models.user import User


def seed_dev_data(db: Session):
    employees_exist = db.query(Employee).filter(Employee.email == "admin@aria.dev").first()
    if not employees_exist:
        _seed_employees_and_leave(db)

    _seed_extra_employees_if_missing(db)
    _seed_payroll_if_missing(db)
    _seed_policies_if_missing(db)


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


def _seed_extra_employees_if_missing(db: Session):
    if db.query(Employee).filter(Employee.email == "sarah.chen@aria.dev").first():
        return

    manager = db.query(Employee).filter(Employee.email == "manager@aria.dev").first()
    if not manager:
        return

    extra = [
        Employee(id=uuid.uuid4(), email="sarah.chen@aria.dev",  full_name="Sarah Chen",  department="Engineering", role="Software Engineer",  manager_id=manager.id, start_date=date(2022, 3, 14)),
        Employee(id=uuid.uuid4(), email="james.kim@aria.dev",   full_name="James Kim",   department="Engineering", role="Product Designer",   manager_id=manager.id, start_date=date(2023, 1, 9)),
        Employee(id=uuid.uuid4(), email="maria.lopez@aria.dev", full_name="Maria Lopez", department="Engineering", role="Senior Engineer",    manager_id=manager.id, start_date=date(2020, 8, 3)),
        Employee(id=uuid.uuid4(), email="alex.tran@aria.dev",   full_name="Alex Tran",   department="Engineering", role="Data Analyst",       manager_id=manager.id, start_date=date(2024, 2, 19)),
        Employee(id=uuid.uuid4(), email="rohan.patel@aria.dev", full_name="Rohan Patel", department="Engineering", role="Backend Engineer",   manager_id=manager.id, start_date=date(2021, 11, 1)),
    ]
    db.add_all(extra)
    db.flush()

    sarah, james, maria, _, _ = extra

    db.add_all([
        LeaveRequest(
            id=uuid.uuid4(),
            employee_id=sarah.id,
            leave_type="annual",
            start_date=date(2026, 6, 20),
            end_date=date(2026, 6, 26),
            days_requested=7,
            status="pending",
            reason="Summer break",
        ),
        LeaveRequest(
            id=uuid.uuid4(),
            employee_id=james.id,
            leave_type="sick",
            start_date=date(2026, 6, 17),
            end_date=date(2026, 6, 18),
            days_requested=2,
            status="pending",
            reason="Not feeling well",
        ),
        LeaveRequest(
            id=uuid.uuid4(),
            employee_id=maria.id,
            leave_type="parental",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 9, 22),
            days_requested=84,
            status="pending",
            reason="Parental leave",
        ),
    ])

    db.commit()
    print("Dev seed: 5 extra employees, 3 extra leave requests")


def _seed_payroll_if_missing(db: Session):
    if db.query(PayrollRecord).first():
        return

    all_emails = [
        "admin@aria.dev", "manager@aria.dev", "employee@aria.dev",
        "sarah.chen@aria.dev", "james.kim@aria.dev", "maria.lopez@aria.dev",
        "alex.tran@aria.dev", "rohan.patel@aria.dev",
    ]
    employees = {
        e.email: e
        for e in db.query(Employee).filter(Employee.email.in_(all_emails)).all()
    }

    periods = [
        (date(2026, 3, 1), date(2026, 3, 31)),
        (date(2026, 4, 1), date(2026, 4, 30)),
        (date(2026, 5, 1), date(2026, 5, 31)),
        (date(2026, 6, 1), date(2026, 6, 30)),
    ]
    payroll_data = [
        ("employee@aria.dev",    Decimal("7800.00"),  Decimal("5460.00")),
        ("manager@aria.dev",     Decimal("12500.00"), Decimal("8500.00")),
        ("admin@aria.dev",       Decimal("9200.00"),  Decimal("6440.00")),
        ("sarah.chen@aria.dev",  Decimal("7800.00"),  Decimal("5460.00")),
        ("james.kim@aria.dev",   Decimal("8500.00"),  Decimal("5950.00")),
        ("maria.lopez@aria.dev", Decimal("9800.00"),  Decimal("6860.00")),
        ("alex.tran@aria.dev",   Decimal("7200.00"),  Decimal("5040.00")),
        ("rohan.patel@aria.dev", Decimal("8200.00"),  Decimal("5740.00")),
    ]
    count = 0
    for email, gross, net in payroll_data:
        emp = employees.get(email)
        if not emp:
            continue
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
            count += 1

    db.commit()
    print(f"Dev seed: {count} payroll records")


def _seed_policies_if_missing(db: Session):
    if db.query(HRPolicy).first():
        return

    policies = [
        HRPolicy(
            id=uuid.uuid4(),
            title="Annual Leave Policy",
            category="leave",
            version="v3.1",
            effective_date=date(2026, 1, 1),
            content=(
                "Employees are entitled to 20 days of paid annual leave per calendar year. "
                "Leave must be requested at least 5 business days in advance and approved by the direct manager. "
                "Unused leave up to 5 days may be carried over to the following year. "
                "Annual leave accrues monthly at 1.67 days per month from the employee's start date."
            ),
        ),
        HRPolicy(
            id=uuid.uuid4(),
            title="Sick Leave & Medical Policy",
            category="leave",
            version="v2.0",
            effective_date=date(2024, 8, 1),
            content=(
                "Employees are entitled to 10 days of paid sick leave per calendar year. "
                "Sick leave does not carry over and resets on January 1st each year. "
                "For absences of 3 or more consecutive days, a medical certificate from a registered physician is required. "
                "Sick leave may not be used as a substitute for annual leave. "
                "Employees should notify their manager as early as possible on the first day of absence."
            ),
        ),
        HRPolicy(
            id=uuid.uuid4(),
            title="Parental Leave Policy",
            category="leave",
            version="v2.1",
            effective_date=date(2025, 3, 1),
            content=(
                "Primary caregivers are entitled to 16 weeks of fully paid parental leave. "
                "Secondary caregivers are entitled to 4 weeks of fully paid parental leave. "
                "Parental leave must commence within 12 months of the child's birth or adoption date. "
                "Employees must provide at least 8 weeks' notice before the intended leave start date. "
                "Parental leave is available to all employees who have completed 12 months of continuous service."
            ),
        ),
        HRPolicy(
            id=uuid.uuid4(),
            title="Payroll & Compensation Policy",
            category="payroll",
            version="v1.2",
            effective_date=date(2025, 11, 1),
            content=(
                "Salaries are paid on the last business day of each calendar month via direct deposit. "
                "All compensation is reviewed annually in Q4, with adjustments effective January 1st. "
                "Overtime for non-exempt employees is compensated at 1.5x the regular hourly rate. "
                "Bonuses are discretionary and subject to individual and company performance. "
                "Payslips are available through the HR portal within 2 business days of the pay date."
            ),
        ),
        HRPolicy(
            id=uuid.uuid4(),
            title="Code of Conduct",
            category="conduct",
            version="v1.4",
            effective_date=date(2026, 2, 1),
            content=(
                "All employees are expected to act with integrity, respect, and professionalism at all times. "
                "Harassment, discrimination, or bullying of any kind will not be tolerated and may result in immediate termination. "
                "Employees must disclose any conflicts of interest to their manager and HR in writing. "
                "Confidential company information must not be shared externally without written authorisation. "
                "Violations of this policy should be reported to HR or via the anonymous ethics hotline."
            ),
        ),
        HRPolicy(
            id=uuid.uuid4(),
            title="Onboarding & Probation Policy",
            category="onboarding",
            version="v1.1",
            effective_date=date(2025, 6, 1),
            content=(
                "All new employees undergo a 90-day probationary period from their start date. "
                "During probation, employees receive weekly check-ins with their manager and access to the onboarding buddy programme. "
                "A formal performance review is conducted at the 30-day, 60-day, and 90-day marks. "
                "Either party may terminate employment during probation with 1 week's written notice. "
                "Upon successful completion of probation, employees are eligible for the full benefits package."
            ),
        ),
    ]

    db.add_all(policies)
    db.commit()
    print(f"Dev seed: {len(policies)} HR policies")
