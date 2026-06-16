# E4-S5 Friendly Agent Job Failures

**Story:** As a user, failed jobs show a friendly message instead of a stack trace.  
**Epic:** E4 - AI Agent Core  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

Agent failures are normal: the model provider can fail, Redis can be unavailable, a tool can raise, or the worker can hit a retry limit. Users should see a calm product message, not a Python exception or stack trace.

The rule:

```text
failed agent jobs return a safe, friendly result message
```

## Current State

Already implemented:

- `run_agent_task(...)` catches exceptions.
- On exception it stores:
  - `job:{job_id}:status = "failed"`,
  - `job:{job_id}:result = "Something went wrong. Please try again."`.
- `GET /api/agent/result/{job_id}` returns the stored result.
- `E4-S7` now scopes status/result reads to the job owner.

Missing:

- tests proving failed jobs return the friendly message,
- a shared constant for the friendly failure message,
- tests proving internal exception text is not stored in Redis,
- tests proving result endpoint returns the safe failed result for the owner.

## Recommended Scope

Keep this story small:

- add a named constant for the friendly failure message,
- use it in `run_agent_task`,
- add task-level tests for failure storage,
- add API-level test for reading a failed job result,
- do not change retry behavior unless needed for testability.

Do not implement UI changes in this story.

## TDD Plan

Create:

```text
backend/tests/tasks/test_agent_task.py
```

Update:

```text
backend/tests/api/test_agent.py
```

### Step 1 - Task Stores Friendly Failure Result

Test shape:

```python
def test_run_agent_task_stores_friendly_failure_message(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr(agent_task, "redis_client", fake_redis)
    monkeypatch.setattr(agent_task, "AgentRunner", failing_runner)

    # call task body with a fake self that has request.id and retry(...)

    assert fake_redis.get("job:job-123:status") == "failed"
    assert fake_redis.get("job:job-123:result") == FRIENDLY_AGENT_FAILURE_MESSAGE
```

Implementation detail:

- `AgentRunner` is currently imported lazily inside `run_agent_task`, which makes direct monkeypatching harder.
- Recommended implementation is to extract the core task body into a helper function that accepts `job_id`.

### Step 2 - Task Does Not Store Exception Text

Test:

```python
assert "sensitive stack detail" not in fake_redis.get("job:job-123:result")
```

### Step 3 - Result Endpoint Returns Friendly Failed Result

Add to `backend/tests/api/test_agent.py`:

```python
def test_job_result_returns_friendly_failed_message_for_owner(...):
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:status", "failed")
    fake_redis.set("job:job-123:result", FRIENDLY_AGENT_FAILURE_MESSAGE)

    response = client.get("/api/agent/result/job-123", headers=...)

    assert response.status_code == 200
    assert response.json()["result"] == FRIENDLY_AGENT_FAILURE_MESSAGE
```

## Implementation Plan

### Step 1 - Add Constant

In `backend/app/tasks/agent_task.py`:

```python
FRIENDLY_AGENT_FAILURE_MESSAGE = "Something went wrong. Please try again."
JOB_TTL_SECONDS = 300
```

Use both constants for Redis writes.

### Step 2 - Extract Core Runner Helper

Recommended helper:

```python
def execute_agent_job(message: str, session_id: str, user_id: str) -> str:
    from app.agent.runner import AgentRunner
    from app.core.database import SessionLocal

    with SessionLocal() as db:
        runner = AgentRunner()
        return runner.run(message=message, session_id=session_id, user_id=user_id, db=db)
```

Then `run_agent_task` calls:

```python
result = execute_agent_job(message, session_id, user_id)
```

This makes failure tests easy:

```python
monkeypatch.setattr(agent_task, "execute_agent_job", failing_execute_agent_job)
```

### Step 3 - Make Retry Testable

The Celery task calls:

```python
raise self.retry(exc=exc, countdown=5) from exc
```

In tests, fake `self.retry(...)` can raise a sentinel exception. That is acceptable; assert Redis state before/after the raised sentinel.

### Step 4 - Add API Result Test

Import:

```python
from app.tasks.agent_task import FRIENDLY_AGENT_FAILURE_MESSAGE
```

Then add the owner result test using existing fake Redis in `test_agent.py`.

## Files To Touch

Expected files:

- `backend/app/tasks/agent_task.py`
- `backend/tests/tasks/test_agent_task.py`
- `backend/tests/api/test_agent.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- agent runner behavior,
- tool behavior,
- frontend chat UI,
- Redis connection setup,
- Celery configuration.

## Acceptance Criteria

This story is done when:

- failed jobs store `status = "failed"`,
- failed jobs store a friendly result message,
- failed jobs do not store raw exception text,
- owner can fetch the friendly failed result,
- non-owner result access remains blocked by `E4-S7`,
- tests do not call real model APIs,
- tests do not require real Redis or Celery workers,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E4-S5` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\tasks\test_agent_task.py
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
E4-S5: return friendly messages for failed agent jobs
```

## Next Story After This

Recommended next story:

**E4-S6 - As a user, I can see tool trace steps for agent actions.**

That story can build on the safe tool logging and response contracts already in place.
