# E5-S3 Manager Agent Leave Tools

**Story:** As a manager, agent tools can read and update direct-report leave requests.  
**Epic:** E5 - Safe Agent Tools  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the first agent story that proves the core MVP claim:

```text
Aria can safely complete a leave approval workflow through an AI assistant
```

The model can request a leave approval or rejection, but backend code must enforce that the current authenticated employee is the direct manager of the request owner. The model must not be allowed to choose `manager_id` or `approved_by`.

## Current State

Already implemented:

- `ToolContext` gives every tool trusted `user` and linked `employee`.
- `get_employee_info` returns the current user's own profile.
- `get_leave_request` returns the current user's own leave requests.
- `list_pending_leave_requests_for_manager(db, manager)` returns pending requests for direct reports.
- `approve_leave_request(db, manager, request_id)` enforces direct-manager authorization.
- `reject_leave_request(db, manager, request_id, payload)` enforces direct-manager authorization.
- `LeaveRequestReject` validates rejection reason.

Current tool state:

- `list_team_leave` still returns `not_implemented`.
- `update_leave_status` still returns `not_implemented`.
- Tool definitions still include model-supplied `manager_id` and `approved_by`, which should no longer be accepted for safe manager actions.

## Recommended Scope

Implement two manager-safe agent tools:

```text
list_team_leave
update_leave_status
```

For this story:

- `list_team_leave` returns pending leave requests for the current manager's direct reports.
- `update_leave_status` approves or rejects a direct-report leave request.
- Current manager identity comes from `context.employee`.
- Ignore or remove model-supplied `manager_id` and `approved_by`.
- Rejection requires a reason.
- Non-managers receive a safe authorization error.
- Non-direct-report requests receive a safe authorization error from the service layer.
- Non-pending requests receive a safe validation error.

Do not implement broad admin override yet. Keep admin behavior explicit for a later story.

## Response Shape

Recommended successful list response:

```json
{
  "tool": "list_team_leave",
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

Recommended successful update response:

```json
{
  "tool": "update_leave_status",
  "leave_request": {
    "id": "...",
    "employee_id": "...",
    "status": "approved",
    "approved_by": "current-manager-employee-id",
    "approved_at": "2026-06-15T..."
  }
}
```

Recommended authorization response:

```json
{
  "error": "not_authorized",
  "tool": "update_leave_status",
  "message": "Not authorized to approve this leave request"
}
```

Recommended validation response:

```json
{
  "error": "invalid_request",
  "tool": "update_leave_status",
  "message": "Leave request is not pending"
}
```

## TDD Plan

Update:

```text
backend/tests/agent/test_leave_tools.py
```

### Step 1 - Manager Can List Pending Team Leave

Test shape:

```python
def test_list_team_leave_returns_pending_direct_report_requests(db):
    # create manager
    # create direct report with manager_id
    # create unrelated employee
    # create pending request for each

    result = list_team_leave(db, context, manager_id="model-supplied-id")

    assert result["tool"] == "list_team_leave"
    assert len(result["leave_requests"]) == 1
    assert result["leave_requests"][0]["employee_id"] == str(direct_report.id)
```

Important assertion:

- pass a fake `manager_id` and prove it does not affect results.

Expected red result:

```text
assert 'not_implemented' == ...
```

### Step 2 - Non-Manager Gets Empty Team List

If a linked employee has no direct reports, the safe result should be:

```python
assert result["leave_requests"] == []
```

This is not an error. It means the user has no pending team leave to review.

### Step 3 - Unlinked User Cannot List Team Leave

Test:

```python
def test_list_team_leave_returns_profile_not_linked_for_unlinked_user(db):
    result = list_team_leave(db, context)

    assert result["error"] == "profile_not_linked"
```

### Step 4 - Manager Can Approve Direct Report Leave

Test:

```python
def test_update_leave_status_approves_direct_report_request(db):
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
```

Important assertion:

- model-supplied `approved_by` is ignored.

### Step 5 - Manager Can Reject With Reason

Test:

```python
def test_update_leave_status_rejects_direct_report_request(db):
    result = update_leave_status(
        db,
        context,
        request_id=str(request.id),
        status="rejected",
        rejection_reason="Coverage issue",
    )

    assert result["leave_request"]["status"] == "rejected"
    assert result["leave_request"]["approved_by"] == str(manager.id)
```

### Step 6 - Reject Requires Reason

Test:

```python
def test_update_leave_status_requires_rejection_reason(db):
    result = update_leave_status(db, context, request_id=str(request.id), status="rejected")

    assert result["error"] == "invalid_request"
```

### Step 7 - Non-Direct Manager Is Blocked

Test:

```python
def test_update_leave_status_blocks_unrelated_manager(db):
    result = update_leave_status(db, context, request_id=str(request.id), status="approved")

    assert result["error"] == "not_authorized"
```

### Step 8 - Unknown Status Is Invalid

Test:

```python
def test_update_leave_status_rejects_unknown_status(db):
    result = update_leave_status(db, context, request_id=str(request.id), status="cancelled")

    assert result["error"] == "invalid_request"
```

## Implementation Plan

### Step 1 - Import Existing Services

In `backend/app/agent/tools/leave_tools.py`, import:

```python
from app.schemas.leave import LeaveRequestReject
from app.services.leave_service import (
    InvalidLeaveRequestError,
    LeaveAuthorizationError,
    LeaveRequestNotFoundError,
    approve_leave_request,
    list_pending_leave_requests_for_manager,
    reject_leave_request,
)
```

Keep `list_leave_requests_for_employee` for the existing self-service tool.

### Step 2 - Add Error Helpers

Recommended helpers:

```python
def _not_authorized(tool_name: str, message: str) -> dict:
    return {"error": "not_authorized", "tool": tool_name, "message": message}


def _invalid_request(tool_name: str, message: str) -> dict:
    return {"error": "invalid_request", "tool": tool_name, "message": message}


def _not_found(tool_name: str, message: str) -> dict:
    return {"error": "not_found", "tool": tool_name, "message": message}
```

This keeps tool responses safe and structured instead of raising raw service exceptions into the model loop.

### Step 3 - Implement `list_team_leave`

Recommended shape:

```python
def list_team_leave(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("list_team_leave")

    requests = list_pending_leave_requests_for_manager(db, context.employee)
    return {
        "tool": "list_team_leave",
        "leave_requests": [_serialize_leave_request(request) for request in requests],
    }
```

Ignore `manager_id` and `status_filter` for this story. Add filtering later if it is needed for UX.

### Step 4 - Implement `update_leave_status`

Recommended shape:

```python
def update_leave_status(db: Session, context: ToolContext, **kwargs) -> dict:
    if not context.employee:
        return _profile_not_linked("update_leave_status")

    request_id = kwargs.get("request_id")
    status = kwargs.get("status")
    if not request_id:
        return _invalid_request("update_leave_status", "request_id is required")

    try:
        if status == "approved":
            request = approve_leave_request(db, context.employee, request_id)
        elif status == "rejected":
            reason = kwargs.get("rejection_reason")
            if not reason or not reason.strip():
                return _invalid_request("update_leave_status", "rejection_reason is required")
            request = reject_leave_request(
                db,
                context.employee,
                request_id,
                LeaveRequestReject(rejection_reason=reason),
            )
        else:
            return _invalid_request("update_leave_status", "status must be approved or rejected")
    except LeaveRequestNotFoundError as exc:
        return _not_found("update_leave_status", str(exc))
    except LeaveAuthorizationError as exc:
        return _not_authorized("update_leave_status", str(exc))
    except InvalidLeaveRequestError as exc:
        return _invalid_request("update_leave_status", str(exc))

    return {
        "tool": "update_leave_status",
        "leave_request": _serialize_leave_request(request),
    }
```

### Step 5 - Update Tool Definitions

In `backend/app/agent/tools/definitions.py`:

Update `update_leave_status`:

```python
"properties": {
    "request_id": {"type": "string"},
    "status": {"type": "string", "enum": ["approved", "rejected"]},
    "rejection_reason": {"type": "string"},
},
"required": ["request_id", "status"],
```

Remove `approved_by`.

Update `list_team_leave`:

```python
"description": "List pending leave requests for the current manager's direct reports.",
"input_schema": {
    "type": "object",
    "properties": {},
},
```

Remove `manager_id` from required inputs.

## Files To Touch

Expected files:

- `backend/app/agent/tools/leave_tools.py`
- `backend/app/agent/tools/definitions.py`
- `backend/tests/agent/test_leave_tools.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- backend leave service authorization rules,
- API leave routes,
- frontend Leave page,
- agent runner loop,
- payroll tools.

## Acceptance Criteria

This story is done when:

- `list_team_leave` returns pending direct-report leave requests for the current manager.
- `list_team_leave` ignores model-supplied `manager_id`.
- `list_team_leave` returns an empty list for linked employees with no direct reports.
- `update_leave_status` approves direct-report pending leave requests.
- `update_leave_status` rejects direct-report pending leave requests with a reason.
- `update_leave_status` ignores model-supplied `approved_by`.
- non-direct managers receive `not_authorized`.
- missing requests receive `not_found`.
- non-pending requests receive `invalid_request`.
- unsupported statuses receive `invalid_request`.
- tool definitions no longer require `manager_id` or `approved_by`.
- tests cover allowed and denied paths.
- full backend tests pass.
- Ruff passes.
- `docs/PROJECT_PLAN.md` marks `E5-S3` as `Verified`.

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
E5-S3: add safe manager leave agent tools
```

## Next Story After This

Recommended next story:

**E5-S4 - As an employee, agent tools cannot read another employee's payroll.**

That story protects a high-sensitivity data area before payroll tools become useful.
