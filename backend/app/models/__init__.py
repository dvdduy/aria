# Import all models so Alembic autogenerate can discover them
from app.models.agent_memory import AgentMemory
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.notification import Notification
from app.models.payroll import PayrollRecord
from app.models.policy import HRPolicy
from app.models.user import User

__all__ = [
    "User", "Employee", "LeaveRequest", "HRPolicy",
    "PayrollRecord", "AgentMemory", "Notification",
]
