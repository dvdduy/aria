# E4-S7 Agent Job Ownership

**Story:** As the backend, agent jobs are scoped to the user who created them.  
**Epic:** E4 - AI Agent Core  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

The agent chat API currently returns job IDs for async work, but job status and result polling are not scoped to the user who created the job.

That means this URL pattern is risky:

```text
GET /api/agent/result/{job_id}
```

If another user obtains or guesses a job id, the backend should not return the result. Agent results may include employee, leave, payroll, or policy information.

The rule:

```text
only the user who created an agent job can read its status or result
```

## Current State

Current flow:

- `POST /api/agent/chat` enqueues `run_agent_task`.
- The Celery task stores:
  - `job:{job_id}:status`,
  - `job:{job_id}:result`.
- `GET /api/agent/status/{job_id}` reads status by job id only.
- `GET /api/agent/result/{job_id}` reads result by job id only.

Missing:

- job owner metadata,
- authorization check before status/result reads,
- tests for owner access and non-owner denial.

## Recommended Scope

Add a Redis owner key:

```text
job:{job_id}:user_id
```

Set it when the chat job is created.

Then protect:

```text
GET /api/agent/status/{job_id}
GET /api/agent/result/{job_id}
```

Rules:

- owner can read status,
- owner can read result,
- non-owner receives `404`,
- missing job owner receives `404`,
- do not reveal whether the job exists to non-owners.

Use `404` rather than `403` so job ids are not enumerable.

## TDD Plan

Create:

```text
backend/tests/api/test_agent.py
```

Use a fake Redis object and fake task object rather than real Redis/Celery.

### Step 1 - Chat Stores Job Owner

Test shape:

```python
def test_chat_stores_job_owner(client, db, monkeypatch):
    user = create_user(...)
    token = create_access_token(str(user.id), is_admin=False)
    fake_redis = FakeRedis()

    monkeypatch.setattr(agent_api, "redis_client", fake_redis)
    monkeypatch.setattr(agent_api.run_agent_task, "delay", fake_delay)

    response = client.post(
        "/api/agent/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "hello"},
    )

    assert response.status_code == 200
    assert fake_redis.get("job:job-123:user_id") == str(user.id)
```

Expected red result:

```text
None == user id
```

### Step 2 - Owner Can Read Status

Test:

```python
def test_job_status_allows_owner(client, ...):
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "done")

    response = client.get("/api/agent/status/job-123", headers=...)

    assert response.status_code == 200
    assert response.json()["status"] == "done"
```

### Step 3 - Non-Owner Cannot Read Status

Test:

```python
def test_job_status_hides_non_owner_job(client, ...):
    fake_redis.set("job:job-123:user_id", str(owner.id))

    response = client.get("/api/agent/status/job-123", headers=other_headers)

    assert response.status_code == 404
```

### Step 4 - Owner Can Read Result

Test:

```python
def test_job_result_allows_owner(client, ...):
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:result", "Done")

    response = client.get("/api/agent/result/job-123", headers=...)

    assert response.status_code == 200
    assert response.json()["result"] == "Done"
```

### Step 5 - Non-Owner Cannot Read Result

Test:

```python
def test_job_result_hides_non_owner_job(client, ...):
    fake_redis.set("job:job-123:user_id", str(owner.id))

    response = client.get("/api/agent/result/job-123", headers=other_headers)

    assert response.status_code == 404
```

### Step 6 - Missing Owner Returns 404

Test both status and result:

```python
def test_job_status_returns_404_when_owner_key_missing(...)
def test_job_result_returns_404_when_owner_key_missing(...)
```

## Implementation Plan

### Step 1 - Add Owner TTL Constant

In `backend/app/api/agent.py`:

```python
JOB_TTL_SECONDS = 300
```

This matches the current task status/result TTL.

### Step 2 - Store Owner On Chat

In `chat(...)`, after creating the task:

```python
redis_client.set(f"job:{task.id}:user_id", str(current_user.id), ex=JOB_TTL_SECONDS)
```

### Step 3 - Add Authorization Helper

In `backend/app/api/agent.py`:

```python
def _authorize_job_access(job_id: str, current_user: User) -> None:
    owner_id = redis_client.get(f"job:{job_id}:user_id")
    if owner_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Job not found")
```

This intentionally returns 404 for both missing jobs and non-owner access.

### Step 4 - Protect Status And Result

In `job_status(...)`:

```python
_authorize_job_access(job_id, current_user)
```

Then read:

```python
status = redis_client.get(f"job:{job_id}:status") or "pending"
```

In `job_result(...)`, do the same before reading result.

### Step 5 - Keep Task TTLs Aligned

In `backend/app/tasks/agent_task.py`, optionally define:

```python
JOB_TTL_SECONDS = 300
```

Then use the constant for status/result. This is small cleanup, not required for the authorization behavior.

Do not make the Celery task responsible for owner assignment. The API knows the authenticated user and can store ownership immediately when the job id is returned.

## Fake Redis For Tests

Recommended test helper:

```python
class FakeRedis:
    def __init__(self):
        self.values = {}

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, ex=None):
        self.values[key] = value
        return True
```

Recommended fake task:

```python
class FakeTask:
    id = "job-123"


def fake_delay(*args, **kwargs):
    return FakeTask()
```

Patch:

```python
from app.api import agent as agent_api

monkeypatch.setattr(agent_api, "redis_client", fake_redis)
monkeypatch.setattr(agent_api.run_agent_task, "delay", fake_delay)
```

## Files To Touch

Expected files:

- `backend/app/api/agent.py`
- `backend/tests/api/test_agent.py`
- `docs/PROJECT_PLAN.md`

Optional:

- `backend/app/tasks/agent_task.py`

Avoid touching:

- agent runner,
- safe tool behavior,
- frontend chat UI,
- Redis connection setup,
- Celery configuration.

## Acceptance Criteria

This story is done when:

- `POST /api/agent/chat` stores the authenticated user id as job owner.
- job owner key has a TTL.
- owner can poll job status.
- owner can fetch job result.
- non-owner receives `404` for status.
- non-owner receives `404` for result.
- missing owner key receives `404`.
- tests do not require real Redis or Celery.
- full backend tests pass.
- Ruff passes.
- `docs/PROJECT_PLAN.md` marks `E4-S7` as `Verified`.

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
E4-S7: scope agent jobs to creating user
```

## Next Story After This

Recommended next story:

**E4-S5 - As a user, failed jobs show a friendly message instead of a stack trace.**

The task currently stores a friendly message, but this story should verify the API behavior and ensure retries do not expose internal errors.
