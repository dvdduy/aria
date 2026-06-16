# E2-S3 Manager Relationship Check

**Story:** As the backend, I can answer whether one employee reports to another.  
**Epic:** E2 - Employee & Team Data  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

Aria must never rely on the AI model to decide authorization. Before leave approval and agent tools are implemented, the backend needs a small trusted helper that answers:

```text
Can this manager act on this employee?
```

This helper will later protect:

- manager leave approvals,
- manager leave rejection,
- safe agent tools,
- employee data access,
- payroll and policy workflows that need manager scoping.

## Current State

Already implemented:

- `get_employee_for_user(db, user)`
- `list_direct_reports(db, manager)`
- `GET /api/employees/me`
- `GET /api/employees/direct-reports`

The employee model already supports direct manager relationships:

```python
manager_id = Column(GUID(), ForeignKey("employees.id"), nullable=True)
```

Missing:

- no boolean permission helper exists yet,
- no tests prove allowed and denied manager relationships.

## Recommended Scope

Add a service helper only:

```text
can_manage_employee(manager, employee) -> bool
```

Recommended rule for this story:

```text
manager can manage employee when employee.manager_id == manager.id
```

Keep this story direct-report-only. Do not include skip-level management, admin override, department fallback, or inactive-user policy yet.

## TDD Plan

### Step 1 - Test Allowed Direct Report

Update `backend/tests/services/test_employee_service.py`.

Test shape:

```python
def test_can_manage_employee_returns_true_for_direct_report(db):
    manager = Employee(
        email="manager@example.com",
        full_name="Example Manager",
    )
    db.add(manager)
    db.commit()
    db.refresh(manager)

    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        manager_id=manager.id,
    )

    assert can_manage_employee(manager, employee) is True
```

Expected red result:

- import failure because `can_manage_employee` does not exist yet.

### Step 2 - Test Denied Non-Report

Add:

```python
def test_can_manage_employee_returns_false_for_non_report(db):
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
    db.refresh(other_manager)

    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        manager_id=other_manager.id,
    )

    assert can_manage_employee(manager, employee) is False
```

### Step 3 - Test Missing Manager Relationship

Add:

```python
def test_can_manage_employee_returns_false_when_employee_has_no_manager(db):
    manager = Employee(
        email="manager@example.com",
        full_name="Example Manager",
    )
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        manager_id=None,
    )

    assert can_manage_employee(manager, employee) is False
```

## Implementation Plan

In `backend/app/services/employee_service.py`, add:

```python
def can_manage_employee(manager: Employee, employee: Employee) -> bool:
    return employee.manager_id == manager.id
```

Potential defensive version:

```python
def can_manage_employee(manager: Employee, employee: Employee) -> bool:
    if not employee.manager_id:
        return False
    return employee.manager_id == manager.id
```

Recommendation:

- use the defensive version because it makes the no-manager case explicit and easy to read.

## Design Notes

This helper intentionally does not accept `user_id` or request input. Higher layers should first resolve trusted employees:

```text
current user -> current employee -> can_manage_employee(current employee, target employee)
```

Future stories may add:

- admin override,
- skip-level management,
- inactive employee rules,
- richer authorization result objects.

Do not add those now. This story should stay small and reliable.

## Files To Touch

Expected files:

- `backend/app/services/employee_service.py`
- `backend/tests/services/test_employee_service.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- API routes,
- auth dependencies,
- employee model structure,
- leave workflow,
- agent tools.

## Acceptance Criteria

This story is done when:

- `can_manage_employee` returns `True` for direct reports,
- it returns `False` for employees managed by someone else,
- it returns `False` when the target employee has no manager,
- service tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E2-S3` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\services\test_employee_service.py
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
E2-S3: add manager relationship check
```

## Next Story After This

Recommended next story:

**E2-S5 - As a user, I can view my own profile information.**

`E2-S4` is admin CRUD and can wait. `E2-S5` is smaller and closer to the employee self-service path.
