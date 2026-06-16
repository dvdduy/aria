"""Employee agent tools.

The functions are explicit stubs until the employee service and authorization
rules are implemented. Keeping the real tool names importable lets the agent
runner start without pretending these tools are production-ready.
"""

from sqlalchemy.orm import Session

from app.agent.tools.context import ToolContext


def _not_implemented(tool_name: str) -> dict:
    return {
        "error": "not_implemented",
        "tool": tool_name,
        "message": "This agent tool is scaffolded but not implemented yet.",
    }


def get_employee_info(db: Session, context: ToolContext, **kwargs) -> dict:
    return _not_implemented("get_employee_info")
