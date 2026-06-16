# E2-S5 My Profile

**Story:** As a user, I can view my own profile information.  
**Epic:** E2 - Employee & Team Data  
**Priority:** P1  
**Status:** Verified  
**Implementation:** Already satisfied by E2-S1.

## Decision

No new backend code is needed for this story.

The user-facing profile behavior was implemented during `E2-S1` through:

```text
GET /api/employees/me
```

That endpoint returns the current authenticated user's linked employee profile.

## Current Behavior

The endpoint:

- requires a bearer token,
- resolves the current user through `get_current_user`,
- resolves the linked employee through `get_employee_for_user`,
- returns profile fields from the employee record,
- returns `404 Employee profile not linked` when the user has no linked employee.

Current response shape:

```json
{
  "id": "...",
  "email": "employee@example.com",
  "full_name": "Example Employee",
  "department": "People Operations",
  "role": "HR Specialist",
  "manager_id": null,
  "is_active": true
}
```

## Existing Test Coverage

Implemented in:

```text
backend/tests/api/test_employees.py
```

Covered behaviors:

- linked users can fetch their profile,
- unlinked users receive `404 Employee profile not linked`.

## Why Not Add Another Endpoint

Adding another profile route would duplicate `/api/employees/me` and make the API less clear.

Keep one canonical endpoint:

```text
GET /api/employees/me
```

Frontend profile UI can use this endpoint later.

## Acceptance Criteria

This story is done because:

- authenticated users can fetch their own employee profile,
- profile data comes from the linked employee record,
- users cannot pass another `employee_id` to fetch someone else's profile,
- unlinked users receive a safe `404`,
- automated API tests already verify the behavior.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\api\test_employees.py
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

Expected result:

```text
pytest: all tests pass
ruff: All checks passed
```

## Commit Message

```text
E2-S5: document existing user profile endpoint
```

## Next Story After This

Recommended next story:

**E3-S1 - As an employee, I can view my own leave requests and statuses.**

`E2-S4` is admin CRUD and can stay deferred until we need admin employee management. The MVP demo benefits more from starting the leave workflow.
