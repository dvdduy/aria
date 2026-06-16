# E3-S3 Pending Team Leave Requests

**Story:** As a manager, I can view pending leave requests for my direct reports.  
**Epic:** E3 - Leave Workflow  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the manager-facing read path for the leave workflow. It sets up the next story, where a manager approves a direct report's leave request.

The important rule:

```text
managers can see pending leave requests only for their own direct reports
```

The client should not send arbitrary employee ids to decide scope.

## Current State

Already implemented:

- `get_employee_for_user(db, user)`,
- `list_direct_reports(db, manager)`,
- `can_manage_employee(manager, employee)`,
- `list_leave_requests_for_employee(db, employee)`,
- `GET /api/leave/mine`,
- `POST /api/leave/mine`.

Missing:

- service helper for pending direct-report leave requests,
- protected manager route,
- tests proving non-direct-report requests are excluded.

## Recommended Scope

Add a service helper:

```text
list_pending_leave_requests_for_manager(db, manager) -> list[LeaveRequest]
```

Add a protected route:

```text
GET /api/leave/team/pending
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

Keep this story read-only. Do not approve or reject leave yet.

## Business Rules

For this story:

- only `pending` requests are returned,
- only direct reports of the current manager are included,
- inactive direct reports are excluded because `list_direct_reports` already filters active employees,
- managers with no direct reports receive an empty list,
- users without a linked employee profile receive `404 Employee profile not linked`.

## TDD Plan

### Step 1 - Service Test For Pending Direct Report Requests

Update `backend/tests/services/test_leave_service.py`.

Test shape:

```python
def test_list_pending_leave_requests_for_manager_returns_direct_report_pending_requests(db):
    manager = Employee(email="manager@example.com", full_name="Example Manager")
    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
```

In practice, remember to commit and refresh `manager` before assigning `manager.id`.

Create:

- one pending request for a direct report,
- one approved request for the same direct report,
- one pending request for an employee managed by someone else.

Expected:

```python
results = list_pending_leave_requests_for_manager(db, manager)

assert len(results) == 1
assert results[0].employee_id == direct_report.id
assert results[0].status == "pending"
```

Expected red result:

- import failure because `list_pending_leave_requests_for_manager` does not exist yet.

### Step 2 - API Test For Manager Pending Team Leave

Update `backend/tests/api/test_leave.py`.

Test shape:

```python
def test_get_team_pending_leave_returns_direct_report_pending_requests(client, db):
    # create manager employee
    # create direct report employee with manager_id
    # create other employee under other manager
    # create pending/approved/other requests
    # create user linked to manager
    # call GET /api/leave/team/pending
```

Expected:

```python
assert response.status_code == 200
body = response.json()
assert len(body) == 1
assert body[0]["employee_id"] == str(direct_report.id)
assert body[0]["status"] == "pending"
```

Expected red result:

- `404 Not Found`, because `/api/leave/team/pending` does not exist yet.

### Step 3 - API Test For Manager With No Direct Reports

Add:

```python
def test_get_team_pending_leave_returns_empty_list_without_direct_reports(client, db):
    # create manager employee
    # create linked user
    # call GET /api/leave/team/pending

    assert response.status_code == 200
    assert response.json() == []
```

### Step 4 - API Test For Unlinked User

Add:

```python
def test_get_team_pending_leave_returns_404_when_user_has_no_employee_link(client, db):
    # create user with employee_id=None
    # call GET /api/leave/team/pending

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"
```

## Implementation Plan

### Step 1 - Add Service Helper

In `backend/app/services/leave_service.py`, add:

```python
def list_pending_leave_requests_for_manager(
    db: Session,
    manager: Employee,
) -> list[LeaveRequest]:
    direct_reports = list_direct_reports(db, manager)
    direct_report_ids = [employee.id for employee in direct_reports]
    if not direct_report_ids:
        return []
    return (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id.in_(direct_report_ids),
            LeaveRequest.status == "pending",
        )
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
```

This requires importing:

```python
from app.services.employee_service import list_direct_reports
```

### Step 2 - Add API Route

In `backend/app/api/leave.py`, import `list_pending_leave_requests_for_manager`.

Then add:

```python
@router.get("/team/pending", response_model=list[LeaveRequestResponse])
def get_team_pending_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    manager = get_employee_for_user(db, current_user)
    if not manager:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return [
        _serialize_leave_request(request)
        for request in list_pending_leave_requests_for_manager(db, manager)
    ]
```

## Files To Touch

Expected files:

- `backend/app/services/leave_service.py`
- `backend/app/api/leave.py`
- `backend/tests/services/test_leave_service.py`
- `backend/tests/api/test_leave.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- approval/rejection behavior,
- employee model structure,
- leave request model structure,
- frontend UI,
- agent tools.

## Acceptance Criteria

This story is done when:

- managers can fetch pending leave requests for active direct reports,
- approved/rejected/cancelled requests are excluded,
- pending requests for non-direct-reports are excluded,
- managers with no direct reports receive an empty list,
- unlinked users receive `404 Employee profile not linked`,
- service tests pass,
- API tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E3-S3` as `Verified`.

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
E3-S3: list pending team leave requests
```

## Next Story After This

Recommended next story:

**E3-S4 - As a manager, I can approve a direct report's leave request.**
