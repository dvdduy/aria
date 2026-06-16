# E2-S1 User Employee Link

**Story:** As an employee, my user account can be linked to an employee record.  
**Epic:** E2 - Employee & Team Data  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

Aria's permission model depends on knowing which employee record belongs to the authenticated user. Auth tells us who the user is. Employee linkage tells us what HR data that user is allowed to see or act on.

This becomes the foundation for:

- viewing my own profile,
- viewing my own leave requests,
- checking manager/direct-report relationships,
- preventing users from reading another employee's data,
- giving agent tools a trusted employee identity.

## Current State

The data model already supports the relationship:

```python
class User(Base):
    employee_id = Column(GUID(), ForeignKey("employees.id"), unique=True, nullable=True)
```

```python
class Employee(Base):
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
```

What is missing:

- no employee service helper,
- no API route exposes the current user's employee profile,
- no tests prove a user can resolve their linked employee record,
- no clear behavior exists for users without an employee link.

## Recommended Scope

Implement a small service helper:

```text
get_employee_for_user(db, user) -> Employee | None
```

Then expose a protected route:

```text
GET /api/employees/me
```

Recommended successful response:

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

Recommended missing-link behavior:

```text
404 Employee profile not linked
```

This route should use `get_current_user`. Do not trust a user-supplied `employee_id`.

## TDD Plan

### Step 1 - Service Test For Linked Employee

Create `backend/tests/services/test_employee_service.py`.

Test shape:

```python
def test_get_employee_for_user_returns_linked_employee(db):
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        department="People Operations",
        role="HR Specialist",
    )
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

    result = get_employee_for_user(db, user)

    assert result is not None
    assert result.id == employee.id
    assert result.email == "employee@example.com"
```

Expected red result:

- import failure because `app.services.employee_service` does not exist yet.

### Step 2 - Service Test For Missing Link

Add:

```python
def test_get_employee_for_user_returns_none_without_employee_link(db):
    user = User(
        email="unlinked@example.com",
        hashed_password=hash_password("correct-password"),
        employee_id=None,
    )

    result = get_employee_for_user(db, user)

    assert result is None
```

Expected behavior:

- users without `employee_id` do not resolve to an employee profile.

### Step 3 - API Test For Current Employee Profile

Create `backend/tests/api/test_employees.py`.

Test shape:

```python
def test_get_my_employee_profile_returns_linked_employee(client, db):
    employee = Employee(
        email="employee@example.com",
        full_name="Example Employee",
        department="People Operations",
        role="HR Specialist",
    )
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

    response = client.get(
        "/api/employees/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "employee@example.com"
    assert body["full_name"] == "Example Employee"
    assert body["department"] == "People Operations"
```

Expected red result:

- `404 Not Found`, because `/api/employees/me` does not exist yet.

### Step 4 - API Test For Missing Employee Link

Add:

```python
def test_get_my_employee_profile_returns_404_when_not_linked(client, db):
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
        "/api/employees/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Employee profile not linked"
```

## Implementation Plan

### Step 1 - Add Employee Service

Create `backend/app/services/employee_service.py`:

```python
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.user import User


def get_employee_for_user(db: Session, user: User) -> Employee | None:
    if not user.employee_id:
        return None
    return db.query(Employee).filter(Employee.id == user.employee_id).first()
```

Keep this intentionally small. Manager relationship logic belongs in later stories.

### Step 2 - Add Employee Response Schema

Recommended file:

```text
backend/app/schemas/employee.py
```

Recommended schema:

```python
from pydantic import BaseModel, EmailStr


class EmployeeProfileResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    department: str | None
    role: str | None
    manager_id: str | None
    is_active: bool
```

### Step 3 - Add `GET /api/employees/me`

In `backend/app/api/employees.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.employee import EmployeeProfileResponse
from app.services.employee_service import get_employee_for_user

router = APIRouter()


@router.get("/me", response_model=EmployeeProfileResponse)
def get_my_employee_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = get_employee_for_user(db, current_user)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not linked",
        )
    return {
        "id": str(employee.id),
        "email": employee.email,
        "full_name": employee.full_name,
        "department": employee.department,
        "role": employee.role,
        "manager_id": str(employee.manager_id) if employee.manager_id else None,
        "is_active": employee.is_active,
    }
```

## Files To Touch

Expected files:

- `backend/app/services/employee_service.py`
- `backend/app/schemas/employee.py`
- `backend/app/api/employees.py`
- `backend/tests/services/test_employee_service.py`
- `backend/tests/api/test_employees.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- auth service,
- JWT implementation,
- employee model structure,
- manager relationship logic,
- frontend UI.

## Acceptance Criteria

This story is done when:

- linked users can resolve their employee record,
- unlinked users receive a safe `404` from `/api/employees/me`,
- `/api/employees/me` is protected by bearer auth,
- employee identity comes from `current_user.employee_id`, not request input,
- service tests pass,
- API tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E2-S1` as `Verified`.

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
E2-S1: link users to employee profiles
```

## Next Story After This

Recommended next story:

**E2-S2 - As a manager, I can see my direct reports.**

That story should build on `manager_id` and add the first manager/team relationship query.
