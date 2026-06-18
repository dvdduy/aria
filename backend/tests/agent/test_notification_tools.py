from app.agent.tools.context import ToolContext
from app.agent.tools.notification_tools import send_notification
from app.models.employee import Employee
from app.models.notification import Notification
from app.models.user import User


def test_send_notification_delivers_to_direct_report(db):
    manager = Employee(email="manager@example.com", full_name="Manager User")
    report = Employee(email="report@example.com", full_name="Direct Report")
    db.add_all([manager, report])
    db.commit()
    db.refresh(manager)
    db.refresh(report)

    report.manager_id = manager.id
    db.commit()

    manager_user = User(email="manager@example.com", hashed_password="h", employee_id=manager.id)
    report_user = User(email="report@example.com", hashed_password="h", employee_id=report.id)
    db.add_all([manager_user, report_user])
    db.commit()
    db.refresh(manager_user)
    db.refresh(report_user)

    context = ToolContext(user=manager_user, employee=manager, is_admin=False)

    result = send_notification(db, context, employee_id=str(report.id), message="Your leave was approved")

    assert result["tool"] == "send_notification"
    assert result["recipient"] == "Direct Report"
    assert result["message"] == "Your leave was approved"
    assert result["notification_id"]

    saved = db.query(Notification).filter(Notification.user_id == report_user.id).first()
    assert saved is not None
    assert saved.message == "Your leave was approved"
    assert saved.is_read is False


def test_send_notification_allows_self_notification(db):
    employee = Employee(email="emp@example.com", full_name="Self")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(email="emp@example.com", hashed_password="h", employee_id=employee.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = send_notification(db, context, employee_id=str(employee.id), message="Reminder")

    assert result["tool"] == "send_notification"
    assert result["recipient"] == "Self"


def test_send_notification_blocks_unrelated_employee(db):
    sender_emp = Employee(email="sender@example.com", full_name="Sender")
    target_emp = Employee(email="target@example.com", full_name="Target")
    db.add_all([sender_emp, target_emp])
    db.commit()
    db.refresh(sender_emp)
    db.refresh(target_emp)

    sender_user = User(email="sender@example.com", hashed_password="h", employee_id=sender_emp.id)
    db.add(sender_user)
    db.commit()
    db.refresh(sender_user)

    context = ToolContext(user=sender_user, employee=sender_emp, is_admin=False)

    result = send_notification(db, context, employee_id=str(target_emp.id), message="Hi")

    assert result["error"] == "not_authorized"
    assert result["tool"] == "send_notification"


def test_send_notification_returns_not_found_for_unknown_employee(db):
    employee = Employee(email="emp@example.com", full_name="Sender")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(email="emp@example.com", hashed_password="h", employee_id=employee.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = send_notification(
        db, context,
        employee_id="00000000-0000-0000-0000-000000000000",
        message="Hello",
    )

    assert result["error"] == "not_found"
    assert result["tool"] == "send_notification"


def test_send_notification_returns_not_found_when_recipient_has_no_user_account(db):
    manager = Employee(email="manager@example.com", full_name="Manager")
    report = Employee(email="report@example.com", full_name="Report")
    db.add_all([manager, report])
    db.commit()
    db.refresh(manager)
    db.refresh(report)

    report.manager_id = manager.id
    db.commit()

    manager_user = User(email="manager@example.com", hashed_password="h", employee_id=manager.id)
    db.add(manager_user)
    db.commit()
    db.refresh(manager_user)

    context = ToolContext(user=manager_user, employee=manager, is_admin=False)

    result = send_notification(db, context, employee_id=str(report.id), message="Hi")

    assert result["error"] == "not_found"
    assert "user account" in result["message"]


def test_send_notification_requires_employee_id(db):
    employee = Employee(email="emp@example.com", full_name="Emp")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(email="emp@example.com", hashed_password="h", employee_id=employee.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = send_notification(db, context, message="Hello")

    assert result["error"] == "invalid_request"
    assert "employee_id" in result["message"]


def test_send_notification_requires_message(db):
    employee = Employee(email="emp@example.com", full_name="Emp")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(email="emp@example.com", hashed_password="h", employee_id=employee.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = send_notification(db, context, employee_id=str(employee.id), message="   ")

    assert result["error"] == "invalid_request"
    assert "message" in result["message"]


def test_send_notification_returns_profile_not_linked_for_unlinked_user(db):
    user = User(email="unlinked@example.com", hashed_password="h")
    db.add(user)
    db.commit()
    db.refresh(user)

    context = ToolContext(user=user, employee=None, is_admin=False)

    result = send_notification(db, context, employee_id="any", message="Hi")

    assert result["error"] == "profile_not_linked"
    assert result["tool"] == "send_notification"
