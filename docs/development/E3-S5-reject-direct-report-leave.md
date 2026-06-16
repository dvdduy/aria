# E3-S5 Reject Direct Report Leave

**Story:** As a manager, I can reject a direct report's leave request with a reason.  
**Epic:** E3 - Leave Workflow  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

Rejection is the sibling workflow to approval. It should use the same backend authorization rules as approval, but it also needs a manager-provided reason so the employee understands the decision.

The important rule:

```text
only the direct manager of the request's employee can reject the request
```

## Current State

Already implemented:

- `approve_leave_request(db, manager, request_id)`,
- `POST /api/leave/{request_id}/approve`,
- `can_manage_employee(manager, employee)`,
- `get_leave_request_for_employee(db, employee, request_id)`,
- direct manager and non-manager tests.

Missing:

- rejection request schema,
- service helper to reject a leave request,
- API route for rejection,
- tests for reason requirement and authorization.

## Recommended Scope

Add a schema:

```text
LeaveRequestReject
```

Add a service helper:

```text
reject_leave_request(db, manager, request_id, payload) -> LeaveRequest
```

Add a protected route:

```text
POST /api/leave/{request_id}/reject
```

Recommended request body:

```json
{
  "rejection_reason": "Coverage is too limited during that week."
}
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
  "status": "rejected",
  "reason": "Family vacation",
  "approved_by": "...",
  "approved_at": "2026-06-15T..."
}
```

Note: the current model has no separate `rejection_reason`, `rejected_by`, or `rejected_at` fields. For this story, reuse:

- `approved_by` as the manager who acted,
- `approved_at` as the action timestamp,
- preserve the original employee-submitted `reason`.

Add real rejection audit fields later if the product needs richer status history.

## Business Rules

For this story:

- request must exist,
- request must be `pending`,
- current user must be linked to an employee record,
- current employee must manage the request's employee,
- rejection sets `status = "rejected"`,
- rejection sets `approved_by` to the manager employee id,
- rejection sets `approved_at` using backend time,
- rejection reason is required in the request body.

Recommended error mapping:

- request not found: `404 Leave request not found`,
- unlinked manager user: `404 Employee profile not linked`,
- not direct manager: `403 Not authorized to reject this leave request`,
- request is not pending: `400 Leave request is not pending`,
- missing/blank rejection reason: `422` validation error.

## TDD Plan

### Step 1 - Service Test For Successful Rejection

Update `backend/tests/services/test_leave_service.py`.

Test shape:

```python
from app.schemas.leave import LeaveRequestReject


def test_reject_leave_request_rejects_direct_report_pending_request(db):
    # create manager
    # create direct report
    # create pending leave request

    result = reject_leave_request(
        db,
        manager,
        request.id,
        LeaveRequestReject(rejection_reason="Coverage issue"),
    )

    assert result.status == "rejected"
    assert result.approved_by == manager.id
    assert result.approved_at is not None
```

Expected red result:

- import failure because `LeaveRequestReject` or `reject_leave_request` does not exist.

### Step 2 - Service Test For Non-Manager Denial

Add:

```python
def test_reject_leave_request_rejects_non_manager(db):
    with pytest.raises(LeaveAuthorizationError):
        reject_leave_request(
            db,
            manager,
            request.id,
            LeaveRequestReject(rejection_reason="Coverage issue"),
        )
```

### Step 3 - Service Test For Non-Pending Request

Add:

```python
def test_reject_leave_request_rejects_non_pending_request(db):
    with pytest.raises(InvalidLeaveRequestError):
        reject_leave_request(
            db,
            manager,
            request.id,
            LeaveRequestReject(rejection_reason="Coverage issue"),
        )
```

### Step 4 - API Test For Successful Rejection

Update `backend/tests/api/test_leave.py`.

Test shape:

```python
def test_reject_leave_request_allows_direct_manager(client, db):
    # create manager
    # create direct report
    # create pending request
    # create user linked to manager

    response = client.post(
        f"/api/leave/{request.id}/reject",
        headers={"Authorization": f"Bearer {token}"},
        json={"rejection_reason": "Coverage issue"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected"
    assert body["approved_by"] == str(manager.id)
    assert body["approved_at"] is not None
```

Expected red result:

- `404 Not Found`, because the route does not exist yet.

### Step 5 - API Tests For Denials

Add API tests for:

- non-manager receives `403`,
- non-pending request receives `400`,
- missing request receives `404`,
- unlinked user receives `404 Employee profile not linked`,
- blank rejection reason receives `422`.

## Implementation Plan

### Step 1 - Add Reject Schema

In `backend/app/schemas/leave.py`:

```python
from pydantic import BaseModel, Field


class LeaveRequestReject(BaseModel):
    rejection_reason: str = Field(min_length=1)
```

If whitespace-only strings should be invalid, add a Pydantic validator. A simple `min_length=1` is acceptable for this story.

### Step 2 - Add Service Helper

In `backend/app/services/leave_service.py`:

```python
def reject_leave_request(
    db: Session,
    manager: Employee,
    request_id,
    payload: LeaveRequestReject,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee or not can_manage_employee(manager, employee):
        raise LeaveAuthorizationError("Not authorized to reject this leave request")

    if request.status != "pending":
        raise InvalidLeaveRequestError("Leave request is not pending")

    request.status = "rejected"
    request.approved_by = manager.id
    request.approved_at = datetime.now(UTC)
    db.commit()
    db.refresh(request)
    return request
```

This is intentionally similar to `approve_leave_request`. A later refactor can extract shared transition logic once both paths are stable.

### Step 3 - Add API Route

In `backend/app/api/leave.py`, import `LeaveRequestReject` and `reject_leave_request`.

Route:

```python
@router.post("/{request_id}/reject", response_model=LeaveRequestResponse)
def reject_team_leave_request(
    request_id: str,
    payload: LeaveRequestReject,
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
        request = reject_leave_request(db, manager, request_id, payload)
    except LeaveRequestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LeaveAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except InvalidLeaveRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _serialize_leave_request(request)
```

Route ordering note:

- keep `/mine` and `/team/pending` above `/{request_id}/reject`,
- keep `/{request_id}/reject` above `/{request_id}`.

## Files To Touch

Expected files:

- `backend/app/schemas/leave.py`
- `backend/app/services/leave_service.py`
- `backend/app/api/leave.py`
- `backend/tests/services/test_leave_service.py`
- `backend/tests/api/test_leave.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- leave model structure,
- notification behavior,
- frontend UI,
- agent tools.

## Acceptance Criteria

This story is done when:

- direct managers can reject pending direct-report leave requests,
- rejection sets `status`, `approved_by`, and `approved_at`,
- request body requires a rejection reason,
- non-managers receive `403`,
- non-pending requests receive `400`,
- missing requests receive `404`,
- unlinked users receive `404 Employee profile not linked`,
- tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E3-S5` as `Verified`.

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
E3-S5: reject direct report leave requests
```

## Next Story After This

Recommended next move:

Switch to frontend wiring for the leave workflow after this story, unless we decide to add audit fields first.
