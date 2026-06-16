# E3-S2 Submit Leave Request

**Story:** As an employee, I can submit a leave request with type, date range, and reason.  
**Epic:** E3 - Leave Workflow  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the first write path in the leave workflow. It lets an authenticated employee create their own leave request, which later manager stories can approve or reject.

The important security rule:

```text
employee_id must come from the authenticated user's linked employee profile
```

The client should not provide `employee_id`.

## Current State

Already implemented:

- `LeaveRequest` model,
- `list_leave_requests_for_employee(db, employee)`,
- `GET /api/leave/mine`,
- `get_employee_for_user(db, user)`.

Missing:

- request schema for leave submission,
- service helper to create a leave request,
- API route to submit leave,
- validation tests for date range and user scoping.

## Recommended Scope

Add a service helper:

```text
submit_leave_request(db, employee, payload) -> LeaveRequest
```

Add a protected route:

```text
POST /api/leave/mine
```

Recommended request body:

```json
{
  "leave_type": "annual",
  "start_date": "2026-07-01",
  "end_date": "2026-07-05",
  "reason": "Family vacation"
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
  "status": "pending",
  "reason": "Family vacation",
  "approved_by": null,
  "approved_at": null
}
```

## Business Rules

For this story:

- valid leave types are `annual`, `sick`, `parental`, and `unpaid`,
- `start_date` must be before or equal to `end_date`,
- `days_requested` is calculated by the backend,
- day count is inclusive,
- new requests always start as `pending`,
- employee identity comes from the authenticated user.

Example:

```text
2026-07-01 to 2026-07-05 = 5 days
```

Do not add balance checks yet. That belongs in a later policy or leave entitlement story.

## TDD Plan

### Step 1 - Service Test For Successful Submission

Update `backend/tests/services/test_leave_service.py`.

Test shape:

```python
from app.schemas.leave import LeaveRequestCreate
from app.services.leave_service import submit_leave_request


def test_submit_leave_request_creates_pending_request_for_employee(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    result = submit_leave_request(
        db,
        employee,
        LeaveRequestCreate(
            leave_type="annual",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 5),
            reason="Family vacation",
        ),
    )

    assert result.employee_id == employee.id
    assert result.leave_type == "annual"
    assert result.days_requested == 5
    assert result.status == "pending"
    assert result.reason == "Family vacation"
```

Expected red result:

- import failure because `LeaveRequestCreate` or `submit_leave_request` does not exist yet.

### Step 2 - Service Test For Invalid Date Range

Add:

```python
import pytest
from app.services.leave_service import InvalidLeaveRequestError


def test_submit_leave_request_rejects_end_date_before_start_date(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")

    with pytest.raises(InvalidLeaveRequestError):
        submit_leave_request(
            db,
            employee,
            LeaveRequestCreate(
                leave_type="annual",
                start_date=date(2026, 7, 5),
                end_date=date(2026, 7, 1),
                reason=None,
            ),
        )
```

### Step 3 - API Test For Successful Submission

Update `backend/tests/api/test_leave.py`.

Test shape:

```python
def test_submit_my_leave_request_creates_pending_request(client, db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    user = User(
        email="employee@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Family vacation",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["employee_id"] == str(employee.id)
    assert body["days_requested"] == 5
    assert body["status"] == "pending"
```

Expected red result:

- `405 Method Not Allowed` or `404 Not Found`, because `POST /api/leave/mine` does not exist yet.

### Step 4 - API Test For Unlinked User

Add:

```python
def test_submit_my_leave_request_returns_404_when_user_has_no_employee_link(client, db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "annual",
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
            "reason": "Family vacation",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"
```

### Step 5 - API Test For Invalid Date Range

Add:

```python
def test_submit_my_leave_request_rejects_invalid_date_range(client, db):
    # setup linked employee and token
    response = client.post(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "leave_type": "annual",
            "start_date": "2026-07-05",
            "end_date": "2026-07-01",
            "reason": "Bad dates",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "End date must be on or after start date"
```

## Implementation Plan

### Step 1 - Add Create Schema

In `backend/app/schemas/leave.py`, add:

```python
from typing import Literal


class LeaveRequestCreate(BaseModel):
    leave_type: Literal["annual", "sick", "parental", "unpaid"]
    start_date: date
    end_date: date
    reason: str | None = None
```

Using `Literal` lets Pydantic reject unknown leave types with a `422` validation response.

### Step 2 - Add Service Helper

In `backend/app/services/leave_service.py`, add:

```python
class InvalidLeaveRequestError(ValueError):
    pass


def submit_leave_request(
    db: Session,
    employee: Employee,
    payload: LeaveRequestCreate,
) -> LeaveRequest:
    if payload.end_date < payload.start_date:
        raise InvalidLeaveRequestError("End date must be on or after start date")

    days_requested = (payload.end_date - payload.start_date).days + 1
    request = LeaveRequest(
        employee_id=employee.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days_requested=days_requested,
        status="pending",
        reason=payload.reason,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request
```

### Step 3 - Add POST Route

In `backend/app/api/leave.py`, import:

```python
from app.schemas.leave import LeaveRequestCreate, LeaveRequestResponse
from app.services.leave_service import (
    InvalidLeaveRequestError,
    list_leave_requests_for_employee,
    submit_leave_request,
)
```

Then add:

```python
@router.post("/mine", response_model=LeaveRequestResponse, status_code=201)
def submit_my_leave_request(
    payload: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    try:
        request = submit_leave_request(db, employee, payload)
    except InvalidLeaveRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _serialize_leave_request(request)
```

## Files To Touch

Expected files:

- `backend/app/schemas/leave.py`
- `backend/app/services/leave_service.py`
- `backend/app/api/leave.py`
- `backend/tests/services/test_leave_service.py`
- `backend/tests/api/test_leave.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- leave approval behavior,
- manager permission behavior,
- employee model structure,
- frontend UI,
- agent tools.

## Acceptance Criteria

This story is done when:

- linked employees can submit leave requests,
- `employee_id` comes from the authenticated user, not the request body,
- `days_requested` is calculated by the backend,
- created requests start as `pending`,
- invalid date ranges return a safe error,
- unknown leave types are rejected by validation,
- unlinked users receive `404 Employee profile not linked`,
- tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E3-S2` as `Verified`.

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
E3-S2: submit employee leave requests
```

## Next Story After This

Recommended next story:

**E3-S3 - As a manager, I can view pending leave requests for my direct reports.**
