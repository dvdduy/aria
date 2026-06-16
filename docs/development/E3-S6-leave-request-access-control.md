# E3-S6 Leave Request Access Control

**Story:** As an employee, I cannot view or modify another employee's leave request.  
**Epic:** E3 - Leave Workflow  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is a security story. Before adding more write actions, the backend should explicitly prove that leave request access is scoped to the authenticated user's employee identity and manager relationship.

Current behavior already prevents broad access in several places:

- `GET /api/leave/mine` returns only the current employee's requests,
- `GET /api/leave/team/pending` returns only direct-report pending requests,
- `POST /api/leave/{request_id}/approve` blocks non-managers.

What is still missing is a direct read-by-id path with explicit access rules. That gives the frontend and future agent tools a safe way to fetch one leave request.

## Recommended Scope

Add a service helper:

```text
get_leave_request_for_employee(db, employee, request_id) -> LeaveRequest
```

Add a protected route:

```text
GET /api/leave/{request_id}
```

Access rules:

- employee can view their own leave request,
- direct manager can view a direct report's leave request,
- unrelated employees cannot view the request,
- missing request returns `404 Leave request not found`,
- unauthorized request returns `403 Not authorized to access this leave request`.

Do not add edit/cancel behavior in this story. Modification protection is already covered by approval authorization; future modify routes should reuse the same permission pattern.

## TDD Plan

### Step 1 - Service Test For Owner Access

Update `backend/tests/services/test_leave_service.py`.

Test shape:

```python
def test_get_leave_request_for_employee_allows_owner(db):
    employee = Employee(email="employee@example.com", full_name="Example Employee")
    db.add(employee)
    db.commit()
    db.refresh(employee)

    request = LeaveRequest(
        employee_id=employee.id,
        leave_type="annual",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 5),
        days_requested=5,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    result = get_leave_request_for_employee(db, employee, request.id)

    assert result.id == request.id
```

Expected red result:

- import failure because `get_leave_request_for_employee` does not exist yet.

### Step 2 - Service Test For Direct Manager Access

Add:

```python
def test_get_leave_request_for_employee_allows_direct_manager(db):
    # create manager
    # create direct report with manager_id
    # create request for direct report

    result = get_leave_request_for_employee(db, manager, request.id)

    assert result.id == request.id
```

### Step 3 - Service Test For Unauthorized Employee

Add:

```python
def test_get_leave_request_for_employee_blocks_unrelated_employee(db):
    # create employee
    # create another employee's request

    with pytest.raises(LeaveAuthorizationError):
        get_leave_request_for_employee(db, employee, request.id)
```

### Step 4 - API Tests

Update `backend/tests/api/test_leave.py`.

Add tests for:

- owner can fetch `GET /api/leave/{request_id}`,
- direct manager can fetch direct report request,
- unrelated employee receives `403`,
- missing request receives `404`,
- unlinked user receives `404 Employee profile not linked`.

Expected red result:

- `404 Not Found`, because the route does not exist yet.

## Implementation Plan

### Step 1 - Add Service Helper

In `backend/app/services/leave_service.py`, add:

```python
def get_leave_request_for_employee(
    db: Session,
    employee: Employee,
    request_id,
) -> LeaveRequest:
    request = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not request:
        raise LeaveRequestNotFoundError("Leave request not found")

    if request.employee_id == employee.id:
        return request

    request_employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if request_employee and can_manage_employee(employee, request_employee):
        return request

    raise LeaveAuthorizationError("Not authorized to access this leave request")
```

### Step 2 - Add API Route

In `backend/app/api/leave.py`, import `get_leave_request_for_employee`.

Then add:

```python
@router.get("/{request_id}", response_model=LeaveRequestResponse)
def get_leave_request(
    request_id: str,
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
        request = get_leave_request_for_employee(db, employee, request_id)
    except LeaveRequestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LeaveAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return _serialize_leave_request(request)
```

Route ordering note:

- Keep specific routes like `/mine` and `/team/pending` above `/{request_id}` so FastAPI does not treat those paths as request ids.

## Files To Touch

Expected files:

- `backend/app/services/leave_service.py`
- `backend/app/api/leave.py`
- `backend/tests/services/test_leave_service.py`
- `backend/tests/api/test_leave.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- rejection behavior,
- approval behavior except shared helper imports,
- frontend UI,
- agent tools.

## Acceptance Criteria

This story is done when:

- owners can view their own leave request by id,
- direct managers can view direct-report leave requests by id,
- unrelated employees receive `403`,
- missing requests receive `404`,
- unlinked users receive `404 Employee profile not linked`,
- existing approve endpoint still blocks unauthorized modification,
- service tests pass,
- API tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E3-S6` as `Verified`.

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
E3-S6: enforce leave request access control
```

## Next Story After This

Recommended next story:

**E3-S5 - As a manager, I can reject a direct report's leave request with a reason.**
