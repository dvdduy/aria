# E1-S3 Duplicate Email Registration

**Story:** As a user, I cannot register the same email twice.  
**Epic:** E1 - Authentication & Roles  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

The current `register_user` flow inserts a new `User` directly and relies on the database unique constraint to reject duplicate emails. That means a duplicate registration can surface as a raw database integrity error instead of a clean API response.

For a user-facing auth flow, duplicate email registration should be intentional:

- service layer detects the duplicate,
- API returns `409 Conflict`,
- response message is clear,
- tests prove both service and API behavior.

This is a small story, but it establishes an important pattern for the rest of the app: business rules live in service code, and API routes translate known domain errors into HTTP responses.

## Recommended Development Approach: TDD

Use a practical TDD loop for this story:

```text
Red   -> write the smallest failing test
Green -> implement the smallest useful change
Refactor -> clean up only after tests pass
```

This story is a good fit for TDD because the expected behavior is clear and easy to verify:

- first registration succeeds,
- second registration with the same email fails,
- service layer raises a known domain exception,
- API layer returns `409 Conflict`,
- database still contains only one user for that email.

Do not start by changing the implementation. Start by adding the tests and running them to confirm they fail for the expected reason.

## Current Behavior

Current service:

```python
def register_user(db: Session, payload: RegisterRequest):
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)
    return {"access_token": token, "token_type": "bearer"}
```

Problem:

- It does not check whether the email already exists.
- Duplicate email errors depend on database behavior.
- The API route does not translate duplicates into `409 Conflict`.

## Design Goal

Add explicit duplicate email handling with a small domain exception.

Target flow:

```text
POST /api/auth/register
  -> auth route calls register_user
  -> register_user checks User.email
  -> if email exists, raises DuplicateEmailError
  -> route catches DuplicateEmailError
  -> route returns 409 Conflict with stable message
```

## Files To Touch

Expected files:

- `backend/app/services/auth_service.py`
- `backend/app/api/auth.py`
- `backend/tests/services/test_auth_service.py`
- `backend/tests/api/test_auth.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- JWT implementation,
- password hashing implementation,
- frontend login/register UI,
- database model structure.

## TDD Implementation Plan

### Step 1 - Write The Failing Service Test

In `backend/tests/services/test_auth_service.py`, add:

```python
import pytest
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.services.auth_service import DuplicateEmailError, register_user
```

Test:

```python
def test_register_user_rejects_duplicate_email(db):
    payload = RegisterRequest(
        email="employee@example.com",
        password="correct-password",
        full_name="Example Employee",
    )
    register_user(db, payload)

    with pytest.raises(DuplicateEmailError):
        register_user(db, payload)

    assert db.query(User).filter(User.email == "employee@example.com").count() == 1
```

Run:

```bash
.venv\Scripts\python.exe -m pytest tests/services/test_auth_service.py
```

Expected red result:

- test fails because `DuplicateEmailError` does not exist yet, or
- duplicate registration raises a raw database error instead of the expected domain exception.

Either failure is useful because it proves the test is describing behavior the app does not support yet.

### Step 2 - Write The Failing API Test

In `backend/tests/api/test_auth.py`, add:

```python
def test_register_endpoint_rejects_duplicate_email(client):
    payload = {
        "email": "employee@example.com",
        "password": "correct-password",
        "full_name": "Example Employee",
    }

    first = client.post("/api/auth/register", json=payload)
    second = client.post("/api/auth/register", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "Email is already registered"
```

Run:

```bash
.venv\Scripts\python.exe -m pytest tests/api/test_auth.py
```

Expected red result:

- second request does not return `409`, or
- response exposes database behavior instead of a stable user-safe message.

### Step 3 - Add A Domain Exception

In `backend/app/services/auth_service.py`, add:

```python
class DuplicateEmailError(ValueError):
    pass
```

Why `ValueError` is okay here:

- It is simple.
- It communicates a domain validation failure.
- The route can catch it explicitly.

Alternative later: create `backend/app/services/errors.py` for shared domain exceptions once more services need them.

### Step 4 - Check Existing Email Before Insert

In `register_user`, check for an existing user:

```python
existing_user = db.query(User).filter(User.email == payload.email).first()
if existing_user:
    raise DuplicateEmailError("Email is already registered")
```

Then continue with user creation.

Design note:

- The unique DB constraint should stay in place. The explicit check improves UX; the DB constraint still protects against race conditions.
- We are not solving race-condition perfect handling in this story. If needed later, catch `IntegrityError` as a second line of defense.

After this step, rerun the service test:

```bash
.venv\Scripts\python.exe -m pytest tests/services/test_auth_service.py
```

Expected green result:

- service test passes,
- API test may still fail until the route maps the domain exception to HTTP.

### Step 5 - Translate Error In API Route

In `backend/app/api/auth.py`, import `DuplicateEmailError` and catch it:

```python
try:
    return register_user(db, payload)
except DuplicateEmailError as exc:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Email is already registered",
    ) from exc
```

Keep `login` behavior unchanged.

### Step 6 - Run Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

Expected:

- All tests pass.
- Ruff passes.

### Step 7 - Refactor Only If Needed

After tests are green, look for small cleanup opportunities:

- remove duplicated payload setup if tests become noisy,
- keep error names clear,
- avoid broader refactors outside the auth story.

Do not move domain exceptions into a shared module yet unless another story needs the same pattern.

## Acceptance Criteria

This story is done when:

- Duplicate email registration is checked in the auth service.
- The API returns `409 Conflict` for duplicate email registration.
- The response detail is stable and user-safe.
- Service tests cover duplicate email behavior.
- API tests cover duplicate email behavior.
- `pytest` passes.
- `ruff check app tests` passes.
- `docs/PROJECT_PLAN.md` marks `E1-S3` as `Verified`.

## Pairing Checklist

- [ ] Add `DuplicateEmailError`.
- [ ] Check for existing email before creating `User`.
- [ ] Catch duplicate exception in `/api/auth/register`.
- [ ] Add service-level duplicate email test.
- [ ] Add API-level duplicate email test.
- [ ] Run backend tests.
- [ ] Run Ruff.
- [ ] Update project plan status.

## Commit Message

```text
E1-S3: reject duplicate email registration
```

## Next Story After This

Recommended next story:

**E1-S4 - As an inactive user, I cannot access protected API routes.**

That story should test `get_current_user`, active/inactive users, and protected route behavior.
