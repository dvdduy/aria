from datetime import date
from decimal import Decimal

from app.agent.tools.context import ToolContext
from app.agent.tools.payroll_tools import get_payroll_summary
from app.models.employee import Employee
from app.models.payroll import PayrollRecord
from app.models.user import User


def test_get_payroll_summary_returns_context_employee_records(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    other_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([employee, other_employee])
    db.commit()
    db.refresh(employee)
    db.refresh(other_employee)

    own_record = PayrollRecord(
        employee_id=employee.id,
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 31),
        gross_salary=Decimal("7500.00"),
        net_salary=Decimal("5200.00"),
        currency="CAD",
    )
    other_record = PayrollRecord(
        employee_id=other_employee.id,
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 31),
        gross_salary=Decimal("9500.00"),
        net_salary=Decimal("6500.00"),
        currency="CAD",
    )
    db.add_all([own_record, other_record])
    db.commit()
    db.refresh(own_record)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = get_payroll_summary(
        db,
        context,
        employee_id=str(other_employee.id),
    )

    assert result["tool"] == "get_payroll_summary"
    assert result["payroll_records"] == [
        {
            "id": str(own_record.id),
            "employee_id": str(employee.id),
            "period_start": "2026-05-01",
            "period_end": "2026-05-31",
            "gross_salary": "7500.00",
            "net_salary": "5200.00",
            "currency": "CAD",
        }
    ]


def test_get_payroll_summary_returns_empty_list_when_no_records(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = get_payroll_summary(db, context)

    assert result == {
        "tool": "get_payroll_summary",
        "payroll_records": [],
    }


def test_get_payroll_summary_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_payroll_summary(db, context)

    assert result == {
        "error": "profile_not_linked",
        "tool": "get_payroll_summary",
        "message": "Your user account is not linked to an employee profile.",
    }
