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
        "description": "Submit a leave request for the currently logged-in employee.",
        "input_schema": {
            "type": "object",
            "properties": {
                "leave_type": {"type": "string", "enum": ["annual", "sick", "parental", "unpaid"]},
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                "reason": {"type": "string"},
            },
            "required": ["leave_type", "start_date", "end_date"],
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
        "description": (
            "Retrieve stored HR policy content by category or keyword. "
            "Use the returned source title and version in the final answer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": (
                        "Broad policy category: 'leave' (covers annual, sick, parental, unpaid leave), "
                        "'payroll' (covers salary, compensation, bonuses), "
                        "'conduct' (covers code of conduct, behaviour), "
                        "'onboarding' (covers new hire process). "
                        "If unsure, omit and rely on keyword instead."
                    ),
                },
                "keyword": {
                    "type": "string",
                    "description": "Search term matched against policy title and body content (e.g. 'sick', 'parental')",
                },
            },
        },
    },
    {
        "name": "get_payroll_summary",
        "description": "Return payroll records for the current user's own employee profile.",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "description": "Optional period label, such as May 2026",
                },
            },
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
