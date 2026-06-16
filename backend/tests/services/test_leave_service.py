from datetime import date

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.services.leave_service import list_leave_requests_for_employee


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
