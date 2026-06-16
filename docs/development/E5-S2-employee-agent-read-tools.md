# E5-S2 Employee Agent Read Tools

**Story:** As an employee, agent tools can read my own profile and leave data.  
**Epic:** E5 - Safe Agent Tools  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the first real agent tool behavior in Aria. The goal is not to make the agent powerful yet; the goal is to make it safe.

The model may ask for profile or leave data, but backend tool code must decide what data is allowed based on `ToolContext`, not model-provided employee IDs.

The rule for this story:

```text
employee self-service tools return only the current authenticated employee's own data
```

## Current State

Already implemented:

- `ToolContext` contains authenticated `user`, linked `employee`, and `is_admin`.
- `dispatch_tool(...)` passes context to every tool.
- `get_employee_for_user(...)` resolves the current employee.
- `list_leave_requests_for_employee(...)` returns leave requests scoped to one employee.
- Backend leave APIs already prove self-access and manager access rules.

Current tool state:

- `get_employee_info(...)` is still a `not_implemented` stub.
- `get_leave_request(...)` is still a `not_implemented` stub.
- Tool definitions still expose `employee_id`, but tools should not trust it for this story.

## Recommended Scope

Implement two safe read tools:

```text
get_employee_info
get_leave_request
```

For this story:

- `get_employee_info` returns the current user's linked employee profile.
- `get_leave_request` returns the current user's own leave requests.
- If the user has no linked employee profile, return a structured `profile_not_linked` error.
- Ignore model-supplied `employee_id` for self-service behavior.
- Do not implement manager reads yet.
- Do not implement leave approval/rejection yet.
- Do not implement payroll reads yet.

This gives the agent its first useful self-service answers while preserving a clear authorization boundary.

## Response Shape

Keep tool responses structured and boring. They should be safe to pass back to the model.

Recommended successful profile response:

```json
{
  "tool": "get_employee_info",
  "employee": {
    "id": "...",
    "email": "employee@aria.dev",
    "full_name": "Employee User",
    "department": "People Operations",
    "role": "HR Coordinator",
    "manager_id": "...",
    "is_active": true
  }
}
```

Recommended successful leave response:

```json
{
  "tool": "get_leave_request",
  "leave_requests": [
    {
      "id": "...",
      "employee_id": "...",
      "leave_type": "annual",
      "start_date": "2026-07-01",
      "end_date": "2026-07-05",
      "days_requested": 5,
      "status": "pending",
      "reason": "Family vacation",
      "approved_by": null,
      "approved_at": null
    }
  ]
}
```

Recommended unlinked response:

```json
{
  "error": "profile_not_linked",
  "tool": "get_employee_info",
  "message": "Your user account is not linked to an employee profile."
}
```

## TDD Plan

Create:

```text
backend/tests/agent/test_employee_tools.py
backend/tests/agent/test_leave_tools.py
```

### Step 1 - Profile Tool Returns Current Employee

Test shape:

```python
def test_get_employee_info_returns_context_employee(db):
    context = ToolContext(user=user, employee=employee, is_admin=False)

    result = get_employee_info(db, context, employee_id="other-id")

    assert result["tool"] == "get_employee_info"
    assert result["employee"]["id"] == str(employee.id)
```

Expected red result:

```text
assert 'not_implemented' == ...
```

Important assertion:

- pass an unrelated `employee_id` input and prove it does not change the returned employee.

### Step 2 - Profile Tool Handles Unlinked User

Test:

```python
def test_get_employee_info_returns_profile_not_linked_for_unlinked_user(db):
    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_employee_info(db, context)

    assert result["error"] == "profile_not_linked"
```

### Step 3 - Leave Tool Returns Own Leave Requests

Test:

```python
def test_get_leave_request_returns_context_employee_leave_requests(db):
    # create current employee
    # create another employee
    # create one leave request for each

    result = get_leave_request(db, context, employee_id=str(other_employee.id))

    assert len(result["leave_requests"]) == 1
    assert result["leave_requests"][0]["employee_id"] == str(employee.id)
```

Important assertion:

- prove model-supplied `employee_id` is ignored for this self-service story.

### Step 4 - Leave Tool Handles Empty Lists

Test:

```python
def test_get_leave_request_returns_empty_list_when_user_has_no_leave(db):
    result = get_leave_request(db, context)

    assert result["leave_requests"] == []
```

### Step 5 - Leave Tool Handles Unlinked User

Test:

```python
def test_get_leave_request_returns_profile_not_linked_for_unlinked_user(db):
    context = ToolContext(user=user, employee=None, is_admin=False)

    result = get_leave_request(db, context)

    assert result["error"] == "profile_not_linked"
```

## Implementation Plan

### Step 1 - Add Serialization Helpers

In `backend/app/agent/tools/employee_tools.py`, add:

```python
def _serialize_employee(employee: Employee) -> dict:
    return {
        "id": str(employee.id),
        "email": employee.email,
        "full_name": employee.full_name,
        "department": employee.department,
        "role": employee.role,
        "manager_id": str(employee.manager_id) if employee.manager_id else None,
        "is_active": employee.is_active,
    }
```

In `backend/app/agent/tools/leave_tools.py`, add:

```python
def _serialize_leave_request(request: LeaveRequest) -> dict:
    return {
        "id": str(request.id),
        "employee_id": str(request.employee_id),
        "leave_type": request.leave_type,
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "days_requested": request.days_requested,
        "status": request.status,
        "reason": request.reason,
        "approved_by": str(request.approved_by) if request.approved_by else None,
        "approved_at": request.approved_at.isoformat() if request.approved_at else None,
    }
```

### Step 2 - Add Shared Error Helper

Use a small local helper in each module or a shared helper if duplication starts growing.

Recommended local helper for now:

```python
def _profile_not_linked(tool_name: str) -> dict:
    return {
        "error": "profile_not_linked",
        "tool": tool_name,
        "message": "Your user account is not linked to an employee profile.",
    }
```

Duplication is acceptable here because we only have two modules. Extract later if three or more tools need the same response.

### Step 3 - Implement `get_employee_info`

In `backend/app/agent/tools/employee_tools.py`:

```python
def get_employee_info(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("get_employee_info")
    return {
        "tool": "get_employee_info",
        "employee": _serialize_employee(context.employee),
    }
```

Do not query by `kwargs["employee_id"]` in this story.

### Step 4 - Implement `get_leave_request`

In `backend/app/agent/tools/leave_tools.py`:

```python
def get_leave_request(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("get_leave_request")

    requests = list_leave_requests_for_employee(db, context.employee)
    return {
        "tool": "get_leave_request",
        "leave_requests": [_serialize_leave_request(request) for request in requests],
    }
```

Do not query by model-supplied `employee_id` in this story.

## Tool Definition Follow-Up

The current `get_leave_request` tool definition requires `employee_id`.

For this story, update the tool definition so employee self-service leave lookup does not require model-provided identity:

```python
{
    "name": "get_leave_request",
    "description": "Fetch the current user's own leave requests.",
    "input_schema": {
        "type": "object",
        "properties": {},
    },
}
```

This is a security improvement and a prompt clarity improvement. Manager-specific lookup can be added in `E5-S3` with a separate tool or carefully authorized inputs.

Similarly, update `get_employee_info` description to say it returns the current user's profile.

## Files To Touch

Expected files:

- `backend/app/agent/tools/employee_tools.py`
- `backend/app/agent/tools/leave_tools.py`
- `backend/app/agent/tools/definitions.py`
- `backend/tests/agent/test_employee_tools.py`
- `backend/tests/agent/test_leave_tools.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- manager leave approval tools,
- payroll tools,
- notification tools,
- frontend chat UI,
- Anthropic runner loop,
- auth/session logic.

## Acceptance Criteria

This story is done when:

- `get_employee_info` returns the current linked employee profile.
- `get_employee_info` ignores model-supplied employee identity.
- `get_leave_request` returns only the current linked employee's leave requests.
- `get_leave_request` ignores model-supplied employee identity.
- unlinked users receive `profile_not_linked`.
- empty leave lists return `leave_requests: []`.
- tool definitions no longer require `employee_id` for self-service leave lookup.
- tests cover allowed and denied paths.
- full backend tests pass.
- Ruff passes.
- `docs/PROJECT_PLAN.md` marks `E5-S2` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

Expected final result:

```text
pytest: all tests pass
ruff: All checks passed
```

## Commit Message

```text
E5-S2: add safe employee self-service agent read tools
```

## Next Story After This

Recommended next story:

**E5-S3 - As a manager, agent tools can read and update direct-report leave requests.**

That story can build on this one by adding direct-report authorization and a protected leave status update tool.
