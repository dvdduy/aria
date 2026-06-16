# E1-S7 Refresh Token Decision

**Story:** As a product owner, I can decide whether refresh tokens are in MVP or deferred.  
**Epic:** E1 - Authentication & Roles  
**Priority:** P1  
**Status:** Verified  
**Decision:** Defer refresh tokens from the MVP.

## Recommendation

Keep Aria's MVP authentication access-token-only.

The current backend issues short-lived JWT access tokens from registration and login. That is enough for the near-term local demo because the main product risk is not long-lived sessions. The main product risk is whether Aria can safely complete HR workflows with server-side authorization.

## Why Defer

Refresh tokens are valuable in production systems, but they introduce extra security and state-management work:

- refresh token storage,
- token rotation,
- logout and revocation behavior,
- stolen-token handling,
- frontend retry behavior,
- additional tests for refresh, expiry, reuse, and logout.

Those are real concerns, but they do not help prove the first MVP demo path:

1. manager logs in,
2. manager views pending leave requests,
3. manager asks Aria to approve a direct report's leave,
4. backend verifies authorization,
5. leave status changes safely.

For a portfolio MVP, it is better to make the authorization model correct and testable before adding session-lifetime complexity.

## Current MVP Auth Policy

For MVP:

- login returns one JWT access token,
- token includes `sub`, `exp`, and `is_admin`,
- protected routes require a valid bearer token,
- inactive users are blocked,
- admin-only routes use `require_admin`,
- token expiry is controlled by `JWT_EXPIRE_HOURS`.

Recommended local/demo setting:

```text
JWT_EXPIRE_HOURS=8
```

This is acceptable for local development and a short demo session. Production can use a shorter access token lifetime once refresh tokens are added.

## Deferred Scope

Do not implement these in the MVP:

- `POST /api/auth/refresh`,
- refresh token database table,
- refresh token cookies,
- token rotation,
- logout revocation list,
- multi-device session management.

Capture them later as a separate security/session epic or a future E1 enhancement.

## Future Design Notes

When refresh tokens are revisited, prefer this direction:

- store refresh tokens server-side as hashed values,
- rotate refresh tokens on every refresh,
- invalidate the previous refresh token after rotation,
- support explicit logout by revoking the current refresh token,
- use secure, HTTP-only cookies if the frontend becomes browser-session based,
- add reuse detection so a replayed refresh token invalidates the session family.

Suggested future stories:

- As a user, I can refresh my access token without logging in again.
- As a user, I can log out and invalidate my current session.
- As the backend, reused refresh tokens are detected and rejected.
- As a developer, refresh-token behavior is covered by service and API tests.

## Acceptance Criteria

This decision is complete when:

- the MVP explicitly stays access-token-only,
- refresh token implementation is deferred,
- docs explain why refresh tokens are not needed for the first demo,
- future refresh-token expectations are captured for later.

## Verification

No code verification is required for this story because it is a product and architecture decision.

Documentation verification:

- `docs/PROJECT_PLAN.md` links to this decision,
- `E1-S7` is marked `Verified`,
- current auth tests remain the verification path for implemented access-token behavior.

Optional sanity check from `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\api\test_auth.py
```

## Commit Message

```text
E1-S7: defer refresh tokens from MVP
```
