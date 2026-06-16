TOOL_DEFINITIONS = [
    {
        "name": "get_employee_info",
        "description": "Fetch the current user's own employee profile.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_leave_request",
        "description": "Fetch the current user's own leave requests.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "submit_leave_request",
        "description": "Submit a new leave request on behalf of an employee.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string"},
                "leave_type": {"type": "string", "enum": ["annual", "sick", "parental", "unpaid"]},
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                "reason": {"type": "string"},
            },
            "required": ["employee_id", "leave_type", "start_date", "end_date"],
        },
    },
    {
        "name": "update_leave_status",
        "description": "Approve or reject a leave request.",
        "input_schema": {
            "type": "object",
            "properties": {
                "request_id": {"type": "string"},
                "status": {"type": "string", "enum": ["approved", "rejected"]},
                "rejection_reason": {"type": "string"},
            },
            "required": ["request_id", "status"],
        },
    },
    {
        "name": "list_team_leave",
        "description": "List pending leave requests for the current manager's direct reports.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_policy",
        "description": "Retrieve an HR policy by category or title keyword.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "leave | payroll | conduct | onboarding",
                },
                "keyword": {"type": "string", "description": "Search term in policy title"},
            },
        },
    },
    {
        "name": "get_payroll_summary",
        "description": "Return payroll records for an employee for a given period.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string"},
                "period": {"type": "string", "description": "e.g. Q1 2026, March 2026, 2025"},
            },
            "required": ["employee_id"],
        },
    },
    {
        "name": "send_notification",
        "description": "Send an in-app notification to an employee.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string"},
                "message": {"type": "string"},
            },
            "required": ["employee_id", "message"],
        },
    },
]
