# E4-S3 Agent Job Result Fetch

**Story:** As a user, I can fetch the completed job result.  
**Epic:** E4 - AI Agent Core  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

After chat enqueue and status polling, the final step is fetching the assistant result. This endpoint is what turns async processing into a user-visible answer.

The rule:

```text
job owners can fetch result text and safe tool trace data
```

## Current State

Already implemented:

- `GET /api/agent/result/{job_id}` exists.
- Result text is read from Redis key `job:{job_id}:result`.
- Tool trace is read from Redis key `job:{job_id}:tool_trace`.
- Missing trace defaults to `[]`.
- Invalid trace JSON defaults to `[]`.
- `E4-S7` enforces job ownership.
- Tests already cover owner result access, tool trace return, invalid trace fallback, failed-result message, non-owner denial, and missing-owner denial.

Missing explicit verification:

- unauthenticated result fetch is rejected,
- owned job with missing result defaults to empty string,
- completed result payload shape remains stable.

## Recommended Scope

This is a verification story.

Likely production code changes:

```text
None
```

Add the missing explicit tests and mark the story verified if they pass.

## TDD Plan

Update:

```text
backend/tests/api/test_agent.py
```

### Step 1 - Result Requires Authentication

Test:

```python
def test_job_result_requires_authentication(client):
    response = client.get("/api/agent/result/job-123")

    assert response.status_code == 403
```

Use `403` because the current auth dependency returns 403 for missing credentials in this project.

### Step 2 - Missing Result Defaults Empty String

Test:

```python
def test_job_result_defaults_to_empty_string_when_result_missing(...):
    fake_redis.set("job:job-123:user_id", str(user.id))

    response = client.get("/api/agent/result/job-123", headers=_auth_headers(user))

    assert response.json() == {
        "job_id": "job-123",
        "result": "",
        "tool_trace": [],
    }
```

This reflects the current endpoint behavior and gives the frontend a stable fallback while a result is not yet written.

### Step 3 - Completed Result Shape

Already mostly covered by:

```text
test_job_result_allows_owner
test_job_result_returns_tool_trace_for_owner
```

Keep those tests as acceptance coverage.

## Implementation Plan

Expected files:

- `backend/tests/api/test_agent.py`
- `docs/PROJECT_PLAN.md`

Only touch `backend/app/api/agent.py` if tests expose a real gap.

## Acceptance Criteria

This story is done when:

- owner can fetch completed result text,
- owner receives `tool_trace`,
- missing trace returns `[]`,
- invalid trace returns `[]`,
- missing result returns empty string for an owned job,
- failed jobs return friendly result text,
- non-owner receives `404`,
- missing owner receives `404`,
- unauthenticated requests are rejected,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E4-S3` as `Verified`.

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
E4-S3: verify agent job result fetch
```

## Next Story After This

Recommended next story:

**E4-S4 - As a user, I can maintain a conversation session.**
