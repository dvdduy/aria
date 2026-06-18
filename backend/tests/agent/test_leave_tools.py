from datetime import date

from app.agent.tools.context import ToolContext
from app.agent.tools.leave_tools import get_leave_request, list_team_leave, update_leave_status
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.user import User


def test_get_leave_request_returns_context_employee_leave_requests(db):
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
    db.refresh(own_request)

    user = User(
        email="user@example.com",
        hashed_password="hashed",
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = get_leave_request(db, context, employee_id=str(other_employee.id))

    assert result["tool"] == "get_leave_request"
    assert result["leave_requests"] == [
        {
            "id": str(own_request.id),
            "employee_id": str(employee.id),
            "employee_name": "Example Employee",
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "days_requested": 5,
            "status": "pending",
            "reason": "Family vacation",
            "approved_by": None,
            "approved_at": None,
        }
    ]


def test_get_leave_request_returns_empty_list_when_user_has_no_leave(db):
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

    result = get_leave_request(db, context)

    assert result == {
        "tool": "get_leave_request",
        "leave_requests": [],
    }


def test_get_leave_request_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_leave_request(db, context)

    assert result == {
        "error": "profile_not_linked",
        "tool": "get_leave_request",
        "message": "Your user account is not linked to an employee profile.",
    }


def test_list_team_leave_returns_pending_direct_report_requests(db):
    manager = Employee(email="manager@example.com", full_name="Manager User")
    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    unrelated_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([manager, direct_report, unrelated_employee])
    db.commit()
    db.refresh(manager)
    db.refresh(direct_report)
    db.refresh(unrelated_employee)

    direct_report.manager_id = manager.id
    db.add(direct_report)
    db.commit()

    team_request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    unrelated_request = LeaveRequest(
        employee_id=unrelated_employee.id,
        leave_type="sick",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 1),
        days_requested=1,
        status="pending",
    )
    db.add_all([team_request, unrelated_request])
    db.commit()
    db.refresh(team_request)

    user = User(email="manager-user@example.com", hashed_password="hashed", employee_id=manager.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=manager, is_admin=False)

    result = list_team_leave(db, context, manager_id="model-supplied-id")

    assert result["tool"] == "list_team_leave"
    assert len(result["leave_requests"]) == 1
    assert result["leave_requests"][0]["id"] == str(team_request.id)
    assert result["leave_requests"][0]["employee_id"] == str(direct_report.id)


def test_list_team_leave_returns_empty_list_for_employee_without_direct_reports(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(email="user@example.com", hashed_password="hashed", employee_id=employee.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = list_team_leave(db, context)

    assert result == {
        "tool": "list_team_leave",
        "status_filter": "pending",
        "leave_requests": [],
    }


def test_list_team_leave_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = list_team_leave(db, context)

    assert result == {
        "error": "profile_not_linked",
        "tool": "list_team_leave",
        "message": "Your user account is not linked to an employee profile.",
    }


def test_update_leave_status_approves_direct_report_request(db):
    manager, request, context = _create_manager_leave_request(db)

    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="approved",
        approved_by="model-supplied-id",
    )

    assert result["tool"] == "update_leave_status"
    assert result["leave_request"]["status"] == "approved"
    assert result["leave_request"]["approved_by"] == str(manager.id)
    assert result["leave_request"]["approved_at"] is not None


def test_update_leave_status_rejects_direct_report_request(db):
    manager, request, context = _create_manager_leave_request(db)

    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="rejected",
        rejection_reason="Coverage issue",
    )

    assert result["tool"] == "update_leave_status"
    assert result["leave_request"]["status"] == "rejected"
    assert result["leave_request"]["approved_by"] == str(manager.id)
    assert result["leave_request"]["approved_at"] is not None


def test_update_leave_status_requires_rejection_reason(db):
    manager, request, context = _create_manager_leave_request(db)

    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="rejected",
    )

    assert manager.id == context.employee.id
    assert result == {
        "error": "invalid_request",
        "tool": "update_leave_status",
        "message": "rejection_reason is required",
    }


def test_update_leave_status_blocks_unrelated_manager(db):
    _, request, _ = _create_manager_leave_request(db)
    unrelated_manager = Employee(email="unrelated@example.com", full_name="Unrelated Manager")
    db.add(unrelated_manager)
    db.commit()
    db.refresh(unrelated_manager)

    user = User(
        email="unrelated-user@example.com",
        hashed_password="hashed",
        employee_id=unrelated_manager.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=unrelated_manager, is_admin=False)

    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="approved",
    )

    assert result == {
        "error": "not_authorized",
        "tool": "update_leave_status",
        "message": "Not authorized to approve this leave request",
    }


def test_update_leave_status_rejects_unknown_status(db):
    _, request, context = _create_manager_leave_request(db)

    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="cancelled",
    )

    assert result == {
        "error": "invalid_request",
        "tool": "update_leave_status",
        "message": "status must be approved or rejected",
    }


def test_update_leave_status_returns_not_found_for_missing_request(db):
    _, _, context = _create_manager_leave_request(db)

    result = update_leave_status(
        db,
        context,
        request_id="00000000-0000-0000-0000-000000000000",
        status="approved",
    )

    assert result == {
        "error": "not_found",
        "tool": "update_leave_status",
        "message": "Leave request not found",
    }


def test_update_leave_status_returns_invalid_request_for_non_pending_request(db):
    _, request, context = _create_manager_leave_request(db, status="approved")

    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="approved",
    )

    assert result == {
        "error": "invalid_request",
        "tool": "update_leave_status",
        "message": "Leave request is not pending",
    }


def test_update_leave_status_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = update_leave_status(
        db,
        context,
        request_id="00000000-0000-0000-0000-000000000000",
        status="approved",
    )

    assert result == {
        "error": "profile_not_linked",
        "tool": "update_leave_status",
        "message": "Your user account is not linked to an employee profile.",
    }


def _create_manager_leave_request(db, status="pending"):
    manager = Employee(email="manager@example.com", full_name="Manager User")
    direct_report = Employee(email="report@example.com", full_name="Direct Report")
    db.add_all([manager, direct_report])
    db.commit()
    db.refresh(manager)
    db.refresh(direct_report)

    direct_report.manager_id = manager.id
    db.add(direct_report)
    db.commit()
    db.refresh(direct_report)

    request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status=status,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    user = User(email="manager-user@example.com", hashed_password="hashed", employee_id=manager.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    return manager, request, ToolContext(user=user, employee=manager, is_admin=False)
