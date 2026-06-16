from datetime import date

import pytest

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate
from app.services.leave_service import (
    InvalidLeaveRequestError,
    list_leave_requests_for_employee,
    submit_leave_request,
)


def test_list_leave_requests_for_employee_returns_only_that_employee_requests(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    other_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([employee, other_employee])
    db.commit()
    db.refresh(employee)
    db.refresh(other_employee)

    own_request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
        reason="Family vacation",
    )
    other_request = LeaveRequest(
        employee_id=other_employee.id,
        leave_type="sick",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 1),
        days_requested=1,
        status="pending",
    )
    db.add_all([own_request, other_request])
    db.commit()

    results = list_leave_requests_for_employee(db, employee)

    assert len(results) == 1
    assert results[0].employee_id == employee.id
    assert results[0].leave_type == "annual"


def test_submit_leave_request_creates_pending_request_for_employee(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    result = submit_leave_request(
        db,
        employee,
        LeaveRequestCreate(
            leave_type="annual",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 5),
            reason="Family vacation",
        ),
    )

    assert result.employee_id == employee.id
    assert result.leave_type == "annual"
    assert result.start_date == date(2026, 7, 1)
    assert result.end_date == date(2026, 7, 5)
    assert result.days_requested == 5
    assert result.status == "pending"
    assert result.reason == "Family vacation"


def test_submit_leave_request_rejects_end_date_before_start_date(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")

    with pytest.raises(InvalidLeaveRequestError):
        submit_leave_request(
            db,
            employee,
            LeaveRequestCreate(
                leave_type="annual",
                start_date=date(2026, 7, 5),
                end_date=date(2026, 7, 1),
                reason=None,
            ),
        )
