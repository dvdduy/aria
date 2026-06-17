"""Notification agent tools."""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext
from app.agent.tools.responses import invalid_request, not_authorized, not_found, profile_not_linked
from app.models.employee import Employee
from app.models.user import User
from app.services.employee_service import can_manage_employee
from app.services.notification_service import create_notification


def send_notification(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return profile_not_linked("send_notification")

    employee_id = kwargs.get("employee_id")
    message = kwargs.get("message", "").strip()

    if not employee_id:
        return invalid_request("send_notification", "employee_id is required")
    if not message:
        return invalid_request("send_notification", "message is required")

    recipient_emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not recipient_emp:
        return not_found("send_notification", "Recipient employee not found")

    is_self = str(recipient_emp.id) == str(context.employee.id)
    is_report = can_manage_employee(context.employee, recipient_emp)
    if not is_self and not is_report:
        return not_authorized(
            "send_notification",
            "You can only notify yourself or your direct reports",
        )

    recipient_user = db.query(User).filter(User.employee_id == recipient_emp.id).first()
    if not recipient_user:
        return not_found("send_notification", "Recipient has no linked user account")

    notif = create_notification(db, recipient_user.id, message)
    return {
        "tool": "send_notification",
        "notification_id": str(notif.id),
        "recipient": recipient_emp.full_name,
        "message": message,
    }
