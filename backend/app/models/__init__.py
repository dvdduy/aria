# Import all models so Alembic autogenerate can discover them
from app.models.user import User
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.policy import HRPolicy
from app.models.payroll import PayrollRecord
from app.models.agent_memory import AgentMemory

__all__ = ["User", "Employee", "LeaveRequest", "HRPolicy", "PayrollRecord", "AgentMemory"]
