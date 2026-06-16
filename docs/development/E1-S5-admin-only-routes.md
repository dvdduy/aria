# E1-S5 Admin Only Routes

**Story:** As an admin, I can access admin-only routes.  
**Epic:** E1 - Authentication & Roles  
**Priority:** P1  
**Recommended next implementation task:** Yes  
**Companion story:** E1-S6 - As a non-admin user, I am blocked from admin-only routes.

## Why This Matters

Aria will eventually include HR operations that should not be available to every authenticated user. The first admin-only route gives the backend a simple, testable authorization pattern before we build sensitive HR workflows.

This story should prove:

- authenticated admin users can access admin-only endpoints,
- authenticated non-admin users receive `403 Forbidden`,
- unauthenticated users still receive `401 Unauthorized` from bearer auth,
- authorization is enforced server-side through `require_admin`.

## Current State

The guard already exists:

```python
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
```

What is missing:

- no route currently uses `require_admin`,
- no test proves admin users can access an admin-only route,
- no test proves non-admin users are blocked from an admin-only route.

## Recommended Scope

Add a small admin-only route under auth:

```text
GET /api/auth/admin-check
```

Recommended response:

```json
{
  "status": "ok",
  "email": "admin@example.com"
}
```

This route is intentionally simple. It exists to verify the guard pattern before admin behavior appears in employee, policy, payroll, or leave workflows.

## TDD Plan

### Step 1 - Write The Failing Admin Access Test

In `backend/tests/api/test_auth.py`, add a test that:

- creates an active admin user,
- creates an access token for that user,
- calls `GET /api/auth/admin-check`,
- expects `200 OK`,
- expects the response email to match the admin user.

Example shape:

```python
def test_admin_check_allows_admin_user(client, db):
    admin_user = User(
        email="admin@example.com",
        hashed_password=hash_password("correct-password"),
        is_admin=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    token = create_access_token(str(admin_user.id), is_admin=admin_user.is_admin)

    response = client.get(
        "/api/auth/admin-check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "email": "admin@example.com",
    }
```

Expected red result:

- `404 Not Found`, because the route does not exist yet.

### Step 2 - Write The Companion Non-Admin Denial Test

This technically belongs to `E1-S6`, but it is worth adding with this story because it proves the route is actually admin-only.

Test shape:

```python
def test_admin_check_blocks_non_admin_user(client, db):
    user = User(
        email="employee@example.com",
        hashed_password=hash_password("correct-password"),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), is_admin=user.is_admin)

    response = client.get(
        "/api/auth/admin-check",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
```

Expected red result before implementation:

- `404 Not Found`, because the route does not exist yet.

Expected result after implementation:

- admin test returns `200`,
- non-admin test returns `403`.

### Step 3 - Add The Route

In `backend/app/api/auth.py`, import `require_admin`:

```python
from app.core.dependencies import get_current_user, require_admin
```

Then add:

```python
@router.get("/admin-check")
def admin_check(current_user: User = Depends(require_admin)):
    return {
        "status": "ok",
        "email": current_user.email,
    }
```

Keep the route small. Do not add real HR admin behavior yet.

## Files To Touch

Expected files:

- `backend/app/api/auth.py`
- `backend/tests/api/test_auth.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- `backend/app/core/security.py`
- JWT payload structure
- database models
- frontend UI

## Acceptance Criteria

This story is done when:

- an admin-only route exists,
- the route depends on `require_admin`,
- active admin users receive `200 OK`,
- active non-admin users receive `403 Forbidden`,
- missing or invalid tokens remain handled by existing auth dependency behavior,
- backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E1-S5` as `Verified`,
- if the companion denial test is added, `E1-S6` may also be marked `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\api\test_auth.py
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
E1-S5: add admin-only auth route guard
```

If implementing E1-S5 and E1-S6 together:

```text
E1-S5/E1-S6: verify admin-only route access
```
