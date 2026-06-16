# E4-S1 Chat Enqueue Job ID

**Story:** As a user, I can submit a chat message and immediately receive a job ID.  
**Epic:** E4 - AI Agent Core  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the front door for the async agent workflow. The user should be able to submit a message, get an immediate job id, and let polling handle the long-running work.

The rule:

```text
chat enqueue returns quickly with a job id and session id without running the agent inline
```

## Current State

Already implemented:

- `POST /api/agent/chat` exists.
- It creates or reuses a `session_id`.
- It calls `run_agent_task.delay(...)`.
- It returns `{ job_id, session_id }`.
- `E4-S7` stores job ownership after enqueue.
- Existing `test_agent.py` covers job owner storage.

Still missing as explicit story verification:

- generated session id when one is not provided,
- preserving caller-provided session id,
- verifying the Celery task receives message, session id, and user id,
- rejecting unauthenticated chat requests,
- ensuring the endpoint does not call the agent runner inline.

## Recommended Scope

Add focused API tests for `POST /api/agent/chat`.

For this story:

- no backend feature redesign,
- no real Redis,
- no real Celery worker,
- no real LLM call,
- no frontend changes.

This is mostly a verification story because the endpoint already exists.

## TDD Plan

Update:

```text
backend/tests/api/test_agent.py
```

### Step 1 - Chat Returns Job ID And Generated Session ID

Test:

```python
def test_chat_returns_job_id_and_generated_session_id(client, db, monkeypatch):
    user = _create_user(db, "owner@example.com")
    fake_redis = FakeRedis()
    captured = {}

    def fake_delay(message, session_id, user_id):
        captured["message"] = message
        captured["session_id"] = session_id
        captured["user_id"] = user_id
        return FakeTask()

    monkeypatch.setattr(agent_api, "redis_client", fake_redis)
    monkeypatch.setattr(agent_api.run_agent_task, "delay", fake_delay)

    response = client.post(
        "/api/agent/chat",
        headers=_auth_headers(user),
        json={"message": "Please review my leave requests"},
    )

    assert response.status_code == 200
    assert response.json()["job_id"] == "job-123"
    assert response.json()["session_id"]
    assert captured["message"] == "Please review my leave requests"
    assert captured["session_id"] == response.json()["session_id"]
    assert captured["user_id"] == str(user.id)
```

### Step 2 - Chat Preserves Provided Session ID

Test:

```python
def test_chat_preserves_provided_session_id(...):
    response = client.post(
        "/api/agent/chat",
        headers=_auth_headers(user),
        json={"message": "hello", "session_id": "session-abc"},
    )

    assert response.json()["session_id"] == "session-abc"
```

### Step 3 - Chat Requires Authentication

Test:

```python
def test_chat_requires_authentication(client):
    response = client.post("/api/agent/chat", json={"message": "hello"})

    assert response.status_code == 401
```

### Step 4 - Chat Stores Job Owner With TTL

This is already covered by `test_chat_stores_job_owner`. Keep it as part of this story's verification.

## Implementation Plan

Likely code changes are minimal.

If current implementation already passes the tests, only update:

- `backend/tests/api/test_agent.py`,
- `docs/PROJECT_PLAN.md`.

If tests reveal a gap:

- adjust `backend/app/api/agent.py` only.

Do not touch:

- `AgentRunner`,
- Celery task body,
- tool behavior,
- frontend chat UI.

## Acceptance Criteria

This story is done when:

- authenticated users can enqueue chat messages,
- response includes `job_id`,
- response includes generated `session_id` when omitted,
- provided `session_id` is preserved,
- task enqueue receives message, session id, and authenticated user id,
- job owner is stored with TTL,
- unauthenticated requests are rejected,
- tests do not call a real worker, Redis, or LLM,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E4-S1` as `Verified`.

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
E4-S1: verify chat enqueue returns job id
```

## Next Story After This

Recommended next story:

**E4-S2 - As a user, I can poll job status until the response is ready.**
