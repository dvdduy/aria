# E4-S2 Agent Job Status Polling

**Story:** As a user, I can poll job status until the response is ready.  
**Epic:** E4 - AI Agent Core  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

Aria runs agent work asynchronously, so the frontend needs a reliable polling endpoint. The endpoint should tell the user whether the job is still running, completed, or failed, while still enforcing job ownership.

The rule:

```text
job status polling returns pending, done, or failed for the job owner only
```

## Current State

Already implemented:

- `GET /api/agent/status/{job_id}` exists.
- Status is read from Redis key `job:{job_id}:status`.
- If no status exists, the endpoint returns `pending`.
- `E4-S7` enforces job ownership through `job:{job_id}:user_id`.
- Tests already cover owner access for `done`, non-owner denial, and missing owner denial.

Missing explicit verification:

- `pending` status is returned,
- `failed` status is returned,
- missing status defaults to `pending` for an owned job,
- unauthenticated status polling is rejected.

## Recommended Scope

This is a verification story.

Likely code changes:

- tests only,
- project plan status update.

Only change production code if the tests expose a real gap.

## TDD Plan

Update:

```text
backend/tests/api/test_agent.py
```

### Step 1 - Pending Status

Test:

```python
def test_job_status_returns_pending_for_owner(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "pending")
    monkeypatch.setattr(agent_api, "redis_client", fake_redis)

    response = client.get("/api/agent/status/job-123", headers=_auth_headers(user))

    assert response.status_code == 200
    assert response.json() == {"job_id": "job-123", "status": "pending"}
```

### Step 2 - Failed Status

Test:

```python
def test_job_status_returns_failed_for_owner(...):
    fake_redis.set("job:job-123:status", "failed")

    assert response.json()["status"] == "failed"
```

### Step 3 - Missing Status Defaults Pending

Test:

```python
def test_job_status_defaults_to_pending_when_status_missing(...):
    fake_redis.set("job:job-123:user_id", str(user.id))

    response = client.get("/api/agent/status/job-123", headers=_auth_headers(user))

    assert response.json()["status"] == "pending"
```

This matters because the API stores owner immediately when enqueue returns, but the worker may not have written status yet.

### Step 4 - Authentication Required

Test:

```python
def test_job_status_requires_authentication(client):
    response = client.get("/api/agent/status/job-123")

    assert response.status_code == 403
```

Use `403` if that is the current FastAPI auth dependency behavior for missing bearer credentials in this project.

## Implementation Plan

Expected production code:

```text
No production code change.
```

If a test fails, inspect `backend/app/api/agent.py` and update only the status endpoint behavior.

## Files To Touch

Expected files:

- `backend/tests/api/test_agent.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- Celery task,
- agent runner,
- result endpoint behavior,
- frontend polling hook,
- tool behavior.

## Acceptance Criteria

This story is done when:

- owner can poll `pending`,
- owner can poll `done`,
- owner can poll `failed`,
- owned job with missing status defaults to `pending`,
- non-owner receives `404`,
- missing owner key receives `404`,
- unauthenticated requests are rejected,
- tests do not require real Redis or Celery,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E4-S2` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\api\test_agent.py
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
E4-S2: verify agent job status polling
```

## Next Story After This

Recommended next story:

**E4-S3 - As a user, I can fetch the completed job result.**
