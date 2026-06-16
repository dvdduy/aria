# E3-S1 My Leave Requests

**Story:** As an employee, I can view my own leave requests and statuses.  
**Epic:** E3 - Leave Workflow  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the first leave-workflow slice. Before users can submit, approve, reject, or ask the AI agent about leave, the backend needs a safe way for an employee to view only their own leave requests.

This story establishes the core pattern:

```text
authenticated user -> linked employee -> employee-scoped leave query
```

The user must not be able to pass another employee id to read someone else's leave data.

## Current State

Already available:

- `LeaveRequest` model,
- `Employee` model,
- `User.employee_id`,
- `get_employee_for_user(db, user)`,
- protected route patterns from auth and employees.

The leave router exists but is empty:

```text
backend/app/api/leave.py
```

Missing:

- leave service helper,
- leave response schema,
- protected route for current user's leave requests,
- tests proving user scoping.

## Recommended Scope

Add a service helper:

```text
list_leave_requests_for_employee(db, employee) -> list[LeaveRequest]
```

Add a protected route:

```text
GET /api/leave/mine
```

Recommended response:

```json
[
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
```

Sort newest first, using `created_at` descending if possible.

## TDD Plan

### Step 1 - Service Test For Employee-Scoped Leave

Create `backend/app/services/leave_service.py` later. First, create `backend/tests/services/test_leave_service.py`.

Test shape:

```python
from datetime import date

from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.services.leave_service import list_leave_requests_for_employee


def test_list_leave_requests_for_employee_returns_only_that_employee_requests(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    other_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([employee, other_employee])
    db.commit()
    db.refresh(employee)
    db.refresh(other_employee)

    own_request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
        reason="Family vacation",
    )
    other_request = LeaveRequest(
        employee_id=other_employee.id,
        leave_type="sick",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 1),
        days_requested=1,
        status="pending",
    )
    db.add_all([own_request, other_request])
    db.commit()

    results = list_leave_requests_for_employee(db, employee)

    assert len(results) == 1
    assert results[0].employee_id == employee.id
    assert results[0].leave_type == "annual"
```

Expected red result:

- import failure because `app.services.leave_service` does not exist yet.

### Step 2 - API Test For Current User's Leave Requests

Create `backend/tests/api/test_leave.py`.

Test shape:

```python
from datetime import date

from app.core.security import create_access_token, hash_password
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.user import User


def test_get_my_leave_requests_returns_only_current_employee_requests(client, db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    other_employee = Employee(email="other@example.com", full_name="Other Employee")
    db.add_all([employee, other_employee])
    db.commit()
    db.refresh(employee)
    db.refresh(other_employee)

    own_request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
        reason="Family vacation",
    )
    other_request = LeaveRequest(
        employee_id=other_employee.id,
        leave_type="sick",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 1),
        days_requested=1,
        status="pending",
    )
    db.add_all([own_request, other_request])

    user = User(
        email="employee@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=employee.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["employee_id"] == str(employee.id)
    assert body[0]["leave_type"] == "annual"
    assert body[0]["status"] == "pending"
```

Expected red result:

- `404 Not Found`, because `/api/leave/mine` does not exist yet.

### Step 3 - API Test For Unlinked User

Add:

```python
def test_get_my_leave_requests_returns_404_when_user_has_no_employee_link(client, db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/leave/mine",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"
```

## Implementation Plan

### Step 1 - Add Leave Service

Create `backend/app/services/leave_service.py`:

```python
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.leave import LeaveRequest


def list_leave_requests_for_employee(db: Session, employee: Employee) -> list[LeaveRequest]:
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
```

### Step 2 - Add Leave Response Schema

Create `backend/app/schemas/leave.py`:

```python
from datetime import date, datetime

from pydantic import BaseModel


class LeaveRequestResponse(BaseModel):
    id: str
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    days_requested: int
    status: str
    reason: str | None
    approved_by: str | None
    approved_at: datetime | None
```

### Step 3 - Add `GET /api/leave/mine`

In `backend/app/api/leave.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.leave import LeaveRequestResponse
from app.services.employee_service import get_employee_for_user
from app.services.leave_service import list_leave_requests_for_employee

router = APIRouter()


def _serialize_leave_request(request):
    return {
        "id": str(request.id),
        "employee_id": str(request.employee_id),
        "leave_type": request.leave_type,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "days_requested": request.days_requested,
        "status": request.status,
        "reason": request.reason,
        "approved_by": str(request.approved_by) if request.approved_by else None,
        "approved_at": request.approved_at,
    }


@router.get("/mine", response_model=list[LeaveRequestResponse])
def get_my_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return [
        _serialize_leave_request(request)
        for request in list_leave_requests_for_employee(db, employee)
    ]
```

## Files To Touch

Expected files:

- `backend/app/services/leave_service.py`
- `backend/app/schemas/leave.py`
- `backend/app/api/leave.py`
- `backend/tests/services/test_leave_service.py`
- `backend/tests/api/test_leave.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- leave model structure,
- manager approval behavior,
- employee service behavior,
- frontend UI,
- agent tools.

## Acceptance Criteria

This story is done when:

- authenticated linked users can fetch their own leave requests,
- the endpoint returns only leave requests for the current user's linked employee,
- users cannot choose another employee id through request input,
- unlinked users receive `404 Employee profile not linked`,
- service tests pass,
- API tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E3-S1` as `Verified`.

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
E3-S1: list current employee leave requests
```

## Next Story After This

Recommended next story:

**E3-S2 - As an employee, I can submit a leave request with type, date range, and reason.**
