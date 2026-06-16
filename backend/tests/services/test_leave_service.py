from datetime import date

import pytest

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate
from app.services.leave_service import (
    InvalidLeaveRequestError,
    LeaveAuthorizationError,
    LeaveRequestNotFoundError,
    approve_leave_request,
    get_leave_request_for_employee,
    list_leave_requests_for_employee,
    list_pending_leave_requests_for_manager,
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


def test_list_pending_leave_requests_for_manager_returns_direct_report_pending_requests(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    other_manager = Employee(email="other.manager@example.com", full_name="Other Manager")
    db.add_all([manager, other_manager])
    db.commit()
    db.refresh(manager)
    db.refresh(other_manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    other_report = Employee(
        email="other.report@example.com",
        full_name="Other Report",
        manager_id=other_manager.id,
    )
    db.add_all([direct_report, other_report])
    db.commit()
    db.refresh(direct_report)
    db.refresh(other_report)

    pending_request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    approved_request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="sick",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 1),
        days_requested=1,
        status="approved",
    )
    other_pending_request = LeaveRequest(
        employee_id=other_report.id,
        leave_type="annual",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 2),
        days_requested=2,
        status="pending",
    )
    db.add_all([pending_request, approved_request, other_pending_request])
    db.commit()

    results = list_pending_leave_requests_for_manager(db, manager)

    assert len(results) == 1
    assert results[0].employee_id == direct_report.id
    assert results[0].status == "pending"


def test_list_pending_leave_requests_for_manager_returns_empty_list_without_direct_reports(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    db.add(manager)
    db.commit()
    db.refresh(manager)

    results = list_pending_leave_requests_for_manager(db, manager)

    assert results == []


def test_approve_leave_request_approves_direct_report_pending_request(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    db.add(manager)
    db.commit()
    db.refresh(manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    db.add(direct_report)
    db.commit()
    db.refresh(direct_report)

    request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    result = approve_leave_request(db, manager, request.id)

    assert result.status == "approved"
    assert result.approved_by == manager.id
    assert result.approved_at is not None


def test_approve_leave_request_rejects_non_manager(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    other_manager = Employee(email="other.manager@example.com", full_name="Other Manager")
    db.add_all([manager, other_manager])
    db.commit()
    db.refresh(other_manager)

    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        manager_id=other_manager.id,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    with pytest.raises(LeaveAuthorizationError):
        approve_leave_request(db, manager, request.id)


def test_approve_leave_request_rejects_non_pending_request(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    db.add(manager)
    db.commit()
    db.refresh(manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    db.add(direct_report)
    db.commit()
    db.refresh(direct_report)

    request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="approved",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    with pytest.raises(InvalidLeaveRequestError):
        approve_leave_request(db, manager, request.id)


def test_approve_leave_request_rejects_missing_request(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")

    with pytest.raises(LeaveRequestNotFoundError):
        approve_leave_request(db, manager, "00000000-0000-0000-0000-000000000000")


def test_get_leave_request_for_employee_allows_owner(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    result = get_leave_request_for_employee(db, employee, request.id)

    assert result.id == request.id


def test_get_leave_request_for_employee_allows_direct_manager(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    db.add(manager)
    db.commit()
    db.refresh(manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    db.add(direct_report)
    db.commit()
    db.refresh(direct_report)

    request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    result = get_leave_request_for_employee(db, manager, request.id)

    assert result.id == request.id


def test_get_leave_request_for_employee_blocks_unrelated_employee(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    other_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([employee, other_employee])
    db.commit()
    db.refresh(employee)
    db.refresh(other_employee)

    request = LeaveRequest(
        employee_id=other_employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    with pytest.raises(LeaveAuthorizationError):
        get_leave_request_for_employee(db, employee, request.id)


def test_get_leave_request_for_employee_rejects_missing_request(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")

    with pytest.raises(LeaveRequestNotFoundError):
        get_leave_request_for_employee(db, employee, "00000000-0000-0000-0000-000000000000")
