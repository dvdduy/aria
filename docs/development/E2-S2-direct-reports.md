# E2-S2 Direct Reports

**Story:** As a manager, I can see my direct reports.  
**Epic:** E2 - Employee & Team Data  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

The first MVP demo depends on a manager acting on leave requests for their own team. Before leave approval exists, the backend needs a reliable way to answer a simpler question:

```text
Who reports directly to the current user?
```

This story builds on `E2-S1`, where authenticated users can resolve their linked employee profile.

## Current State

The employee model already supports manager relationships:

```python
manager_id = Column(GUID(), ForeignKey("employees.id"), nullable=True)
```

Already implemented:

- `get_employee_for_user(db, user)`
- `GET /api/employees/me`

Missing:

- service helper to list direct reports,
- protected API route for the current manager's direct reports,
- tests proving only the current user's direct reports are returned.

## Recommended Scope

Add a service helper:

```text
list_direct_reports(db, manager) -> list[Employee]
```

Add a protected route:

```text
GET /api/employees/direct-reports
```

Recommended response:

```json
[
  {
    "id": "...",
    "email": "sarah.chen@example.com",
    "full_name": "Sarah Chen",
    "department": "People Operations",
    "role": "HR Specialist",
    "manager_id": "...",
    "is_active": true
  }
]
```

Keep this to direct reports only. Do not include skip-level reports yet.

## TDD Plan

### Step 1 - Service Test For Direct Reports

Update `backend/tests/services/test_employee_service.py`.

Test shape:

```python
def test_list_direct_reports_returns_only_direct_reports(db):
    manager = Employee(
        email="manager@example.com",
        full_name="Example Manager",
    )
    other_manager = Employee(
        email="other.manager@example.com",
        full_name="Other Manager",
    )
    db.add_all([manager, other_manager])
    db.commit()
    db.refresh(manager)
    db.refresh(other_manager)

    direct_report = Employee(
        email="report@example.com",
        full_name="Direct Report",
        manager_id=manager.id,
    )
    other_report = Employee(
        email="other.report@example.com",
        full_name="Other Report",
        manager_id=other_manager.id,
    )
    db.add_all([direct_report, other_report])
    db.commit()

    results = list_direct_reports(db, manager)

    assert [employee.email for employee in results] == ["report@example.com"]
```

Expected red result:

- import failure because `list_direct_reports` does not exist yet.

### Step 2 - API Test For Current Manager

Update or create `backend/tests/api/test_employees.py`.

Test shape:

```python
def test_get_my_direct_reports_returns_current_managers_reports(client, db):
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

    user = User(
        email="manager@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=manager.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/employees/direct-reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["email"] == "report@example.com"
```

Expected red result:

- `404 Not Found`, because the route does not exist yet.

### Step 3 - API Test For Unlinked User

Add:

```python
def test_get_my_direct_reports_returns_404_when_user_has_no_employee_link(client, db):
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
        "/api/employees/direct-reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"
```

## Implementation Plan

### Step 1 - Add Service Helper

In `backend/app/services/employee_service.py`, add:

```python
def list_direct_reports(db: Session, manager: Employee) -> list[Employee]:
    return (
        db.query(Employee)
        .filter(Employee.manager_id == manager.id, Employee.is_active.is_(True))
        .order_by(Employee.full_name)
        .all()
    )
```

Recommendation:

- return only active employees for now,
- sort by `full_name` for stable API responses and tests.

### Step 2 - Reuse Employee Profile Schema

`EmployeeProfileResponse` is enough for this story.

If the name starts to feel too specific later, rename it to `EmployeeResponse`, but avoid that refactor in this story unless it becomes awkward.

### Step 3 - Add API Route

In `backend/app/api/employees.py`, add:

```python
@router.get("/direct-reports", response_model=list[EmployeeProfileResponse])
def get_my_direct_reports(
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
        {
            "id": str(employee.id),
            "email": employee.email,
            "full_name": employee.full_name,
            "department": employee.department,
            "role": employee.role,
            "manager_id": str(employee.manager_id) if employee.manager_id else None,
            "is_active": employee.is_active,
        }
        for employee in list_direct_reports(db, manager)
    ]
```

Small refactor option:

- extract a private `_serialize_employee(employee)` helper in `employees.py` to avoid duplicating response mapping between `/me` and `/direct-reports`.

That refactor is okay because it reduces immediate duplication in the same file.

## Files To Touch

Expected files:

- `backend/app/services/employee_service.py`
- `backend/app/api/employees.py`
- `backend/tests/services/test_employee_service.py`
- `backend/tests/api/test_employees.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- employee model structure,
- auth routes,
- leave workflow,
- agent tools,
- frontend UI.

## Acceptance Criteria

This story is done when:

- managers can fetch direct reports from `/api/employees/direct-reports`,
- response includes only employees whose `manager_id` matches the current user's employee id,
- inactive reports are not returned,
- unlinked users receive `404 Employee profile not linked`,
- endpoint is protected by bearer auth,
- service tests pass,
- API tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E2-S2` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\services\test_employee_service.py
.venv\Scripts\python.exe -m pytest tests\api\test_employees.py
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
E2-S2: list manager direct reports
```

## Next Story After This

Recommended next story:

**E2-S3 - As the backend, I can answer whether one employee reports to another.**

That story should add a boolean permission helper such as:

```text
can_manage_employee(db, manager, employee) -> bool
```
