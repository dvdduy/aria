# E1-S4 Inactive User Protected Routes

**Story:** As an inactive user, I cannot access protected API routes.  
**Epic:** E1 - Authentication & Roles  
**Priority:** P0  
**Status:** Verified

## What Changed

Added a small protected auth route:

```text
GET /api/auth/me
```

This route returns the current authenticated user and gives the test suite a clean protected endpoint that does not depend on Redis, agent jobs, or future HR workflow features.

Updated `get_current_user` so it now:

- decodes the bearer token,
- loads the user by token subject,
- returns `401 Unauthorized` when the user does not exist,
- returns `403 Forbidden` when the user exists but is inactive,
- returns the active user for protected routes.

## TDD Notes

The red test was:

```text
inactive user token should receive 403 from GET /api/auth/me
```

Before the implementation change, inactive users were blocked, but they received `401 User not found` because the query filtered inactive users out. The dependency now distinguishes missing users from inactive users.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

Verified result:

```text
pytest: 11 passed
ruff: All checks passed
```

Pytest currently reports a third-party `python-jose` deprecation warning for `datetime.utcnow()`. It does not fail the suite.

## Commit Message

```text
E1-S4: block inactive users from protected routes
```
