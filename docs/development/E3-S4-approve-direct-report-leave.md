# E3-S4 Approve Direct Report Leave

**Story:** As a manager, I can approve a direct report's leave request.  
**Epic:** E3 - Leave Workflow  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the first core HR workflow action. It proves Aria can safely move a leave request from pending to approved while enforcing manager authorization in backend code.

The important rule:

```text
only the direct manager of the request's employee can approve the request
```

The model or frontend must not decide authorization.

## Current State

Already implemented:

- `get_employee_for_user(db, user)`,
- `can_manage_employee(manager, employee)`,
- `list_pending_leave_requests_for_manager(db, manager)`,
- `GET /api/leave/team/pending`,
- `LeaveRequest.approved_by`,
- `LeaveRequest.approved_at`,
- `LeaveRequest.status`.

Missing:

- service helper to approve a leave request,
- API route for approval,
- tests for allowed approval and denied approval.

## Recommended Scope

Add a service helper:

```text
approve_leave_request(db, manager, request_id) -> LeaveRequest
```

Add a protected route:

```text
POST /api/leave/{request_id}/approve
```

Recommended response:

```json
{
  "id": "...",
  "employee_id": "...",
  "leave_type": "annual",
  "start_date": "2026-07-01",
  "end_date": "2026-07-05",
  "days_requested": 5,
  "status": "approved",
  "reason": "Family vacation",
  "approved_by": "...",
  "approved_at": "2026-06-15T..."
}
```

Keep this story approval-only. Rejection belongs to `E3-S5`.

## Business Rules

For this story:

- request must exist,
- request must be `pending`,
- current user must be linked to an employee record,
- current employee must manage the request's employee,
- approval sets `status = "approved"`,
- approval sets `approved_by` to the manager employee id,
- approval sets `approved_at` using backend time,
- already approved/rejected/cancelled requests cannot be approved again.

Recommended error mapping:

- request not found: `404 Leave request not found`,
- unlinked manager user: `404 Employee profile not linked`,
- not the direct manager: `403 Not authorized to approve this leave request`,
- request is not pending: `400 Leave request is not pending`.

## TDD Plan

### Step 1 - Service Test For Successful Approval

Update `backend/tests/services/test_leave_service.py`.

Test shape:

```python
def test_approve_leave_request_approves_direct_report_pending_request(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    db.add(manager)
    db.commit()
    db.refresh(manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    db.add(direct_report)
    db.commit()
    db.refresh(direct_report)

    request = LeaveRequest(
        employee_id=direct_report.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    result = approve_leave_request(db, manager, request.id)

    assert result.status == "approved"
    assert result.approved_by == manager.id
    assert result.approved_at is not None
```

Expected red result:

- import failure because `approve_leave_request` does not exist yet.

### Step 2 - Service Test For Non-Manager Denial

Add:

```python
def test_approve_leave_request_rejects_non_manager(db):
    # create manager
    # create employee who reports to someone else
    # create pending leave request for that employee

    with pytest.raises(LeaveAuthorizationError):
        approve_leave_request(db, manager, request.id)
```

Expected:

- service raises a known authorization exception.

### Step 3 - Service Test For Non-Pending Request

Add:

```python
def test_approve_leave_request_rejects_non_pending_request(db):
    # create direct report request with status="approved"

    with pytest.raises(InvalidLeaveRequestError):
        approve_leave_request(db, manager, request.id)
```

### Step 4 - API Test For Successful Approval

Update `backend/tests/api/test_leave.py`.

Test shape:

```python
def test_approve_leave_request_allows_direct_manager(client, db):
    # create manager
    # create direct report
    # create pending leave request
    # create user linked to manager
    # POST /api/leave/{request_id}/approve

    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert response.json()["approved_by"] == str(manager.id)
    assert response.json()["approved_at"] is not None
```

Expected red result:

- `404 Not Found`, because the route does not exist yet.

### Step 5 - API Test For Non-Manager Denial

Add:

```python
def test_approve_leave_request_blocks_non_manager(client, db):
    # current user is not the target employee's direct manager

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to approve this leave request"
```

### Step 6 - API Test For Non-Pending Request

Add:

```python
def test_approve_leave_request_rejects_non_pending_request(client, db):
    # direct manager tries to approve already approved request

    assert response.status_code == 400
    assert response.json()["detail"] == "Leave request is not pending"
```

## Implementation Plan

### Step 1 - Add Exceptions

In `backend/app/services/leave_service.py`, add:

```python
class LeaveRequestNotFoundError(ValueError):
    pass


class LeaveAuthorizationError(PermissionError):
    pass
```

Keep `InvalidLeaveRequestError` for invalid state transitions.

### Step 2 - Add Approval Helper

In `backend/app/services/leave_service.py`, add:

```python
from datetime import UTC, datetime
from app.services.employee_service import can_manage_employee
```

Then:

```python
def approve_leave_request(
    db: Session,
    manager: Employee,
    request_id,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee or not can_manage_employee(manager, employee):
        raise LeaveAuthorizationError("Not authorized to approve this leave request")

    if request.status != "pending":
        raise InvalidLeaveRequestError("Leave request is not pending")

    request.status = "approved"
    request.approved_by = manager.id
    request.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request
```

### Step 3 - Add API Route

In `backend/app/api/leave.py`, import the new exceptions and helper:

```python
from app.core.types import GUID
from app.services.leave_service import (
    InvalidLeaveRequestError,
    LeaveAuthorizationError,
    LeaveRequestNotFoundError,
    approve_leave_request,
    ...
)
```

Route:

```python
@router.post("/{request_id}/approve", response_model=LeaveRequestResponse)
def approve_team_leave_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    manager = get_employee_for_user(db, current_user)
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    try:
        request = approve_leave_request(db, manager, request_id)
    except LeaveRequestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LeaveAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except InvalidLeaveRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _serialize_leave_request(request)
```

Note:

- `request_id` can stay as `str`; the existing `GUID` type handles comparisons in SQLite/Postgres when given UUID-like strings. If tests show otherwise, convert with `uuid.UUID(request_id)` and map invalid UUID to `404`.

## Files To Touch

Expected files:

- `backend/app/services/leave_service.py`
- `backend/app/api/leave.py`
- `backend/tests/services/test_leave_service.py`
- `backend/tests/api/test_leave.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- rejection behavior,
- notification behavior,
- frontend UI,
- agent tools.

## Acceptance Criteria

This story is done when:

- direct managers can approve pending direct-report leave requests,
- approval sets `status`, `approved_by`, and `approved_at`,
- non-managers receive `403`,
- non-pending requests receive `400`,
- missing requests receive `404`,
- unlinked users receive `404 Employee profile not linked`,
- service tests pass,
- API tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E3-S4` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\services\test_leave_service.py
.venv\Scripts\python.exe -m pytest tests\api\test_leave.py
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
E3-S4: approve direct report leave requests
```

## Next Story After This

Recommended next story:

**E3-S6 - As an employee, I cannot view or modify another employee's leave request.**

`E3-S5` rejection can follow, but `E3-S6` is a security story and should be verified before expanding write actions further.
