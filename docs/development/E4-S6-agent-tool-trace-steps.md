# E4-S6 Agent Tool Trace Steps

**Story:** As a user, I can see tool trace steps for agent actions.  
**Epic:** E4 - AI Agent Core  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

The MVP story depends on trust: Aria should not feel like a black box when it approves leave or reads HR data. A compact tool trace helps the user see that the assistant used backend tools and that the system made an authorized decision.

The trace should show safe operational steps, not raw tool payloads.

The rule:

```text
show what tool ran and whether it succeeded, without exposing sensitive tool input or output
```

## Current State

Already implemented:

- agent tools return structured safe responses,
- `dispatch_tool(...)` logs safe summaries,
- `summarize_tool_result(...)` creates non-sensitive summaries,
- agent job status/result endpoints are scoped to the creating user,
- frontend styles already include `.tool-trace` classes,
- `ChatPage` is still a placeholder,
- `useAgentChat` currently expects `result` as a plain string.

Current backend result shape:

```json
{
  "job_id": "job-123",
  "result": "Assistant answer"
}
```

Recommended next result shape:

```json
{
  "job_id": "job-123",
  "result": "Assistant answer",
  "tool_trace": [
    {
      "tool": "list_team_leave",
      "status": "success",
      "summary": "leave_requests:2"
    },
    {
      "tool": "update_leave_status",
      "status": "success",
      "summary": "leave_request:approved"
    }
  ]
}
```

## Recommended Scope

Build the backend trace contract first, then wire the frontend message model.

For this story:

- add a `ToolTraceStep` schema,
- update `JobResultResponse` to include `tool_trace`,
- collect trace steps while the agent runner executes tools,
- store the trace alongside the job result in Redis,
- return `tool_trace: []` for jobs with no tools or failed jobs,
- update frontend API/types/hooks to accept trace steps,
- optionally render a minimal trace block in `ChatPage` if implementing frontend in the same story.

Do not log or expose:

- raw tool inputs,
- raw payroll amounts,
- full employee records,
- full leave request records,
- exception text,
- model prompt contents.

## Backend Design

Add schema:

```python
class ToolTraceStep(BaseModel):
    tool: str
    status: Literal["success", "error"]
    summary: str
    error_code: str | None = None
```

Update:

```python
class JobResultResponse(BaseModel):
    job_id: str
    result: str
    tool_trace: list[ToolTraceStep] = []
```

Recommended internal result object:

```python
@dataclass
class AgentRunResult:
    message: str
    tool_trace: list[dict]
```

`AgentRunner.run(...)` can return this object instead of a plain string. If we want the smallest compatibility change, return a dict:

```python
{
    "message": final_text,
    "tool_trace": tool_trace,
}
```

The task can then serialize:

```python
redis_client.set(f"job:{job_id}:result", result["message"], ex=JOB_TTL_SECONDS)
redis_client.set(f"job:{job_id}:tool_trace", json.dumps(result["tool_trace"]), ex=JOB_TTL_SECONDS)
```

## Trace Collection

In `AgentRunner.run(...)`, keep:

```python
tool_trace = []
```

When a tool is dispatched:

```python
result = dispatch_tool(block.name, block.input, db, tool_context)
tool_trace.append(
    {
        "tool": block.name,
        "status": "error" if result.get("error") else "success",
        "summary": summarize_tool_result(result),
        "error_code": result.get("error"),
    }
)
```

Use the existing `summarize_tool_result(...)` helper so logging and UI trace summaries stay aligned.

## TDD Plan

### Step 1 - Runner Trace Unit Test

Create:

```text
backend/tests/agent/test_runner_trace.py
```

Recommended test:

```python
def test_agent_runner_returns_tool_trace(monkeypatch, db):
    # fake model response 1: tool_use list_team_leave
    # fake model response 2: end_turn "Approved."
    # monkeypatch dispatch_tool to return {"leave_requests": []}

    result = runner.run(...)

    assert result["message"] == "Approved."
    assert result["tool_trace"] == [
        {
            "tool": "list_team_leave",
            "status": "success",
            "summary": "leave_requests:0",
            "error_code": None,
        }
    ]
```

If mocking Anthropic response objects is too heavy, test a smaller helper that builds a trace step from tool name and result:

```python
build_tool_trace_step("list_team_leave", {"leave_requests": []})
```

This helper-first approach is safer for the first implementation.

### Step 2 - Task Stores Tool Trace

Update:

```text
backend/tests/tasks/test_agent_task.py
```

Test:

```python
def test_run_agent_task_stores_tool_trace(monkeypatch):
    monkeypatch.setattr(
        agent_task,
        "execute_agent_job",
        lambda **kwargs: {
            "message": "Done",
            "tool_trace": [{"tool": "list_team_leave", "status": "success", "summary": "leave_requests:1"}],
        },
    )

    run_agent_task_body(...)

    assert json.loads(fake_redis.get("job:job-123:tool_trace")) == [...]
```

### Step 3 - Result Endpoint Returns Trace

Update:

```text
backend/tests/api/test_agent.py
```

Test:

```python
def test_job_result_returns_tool_trace_for_owner(...):
    fake_redis.set("job:job-123:user_id", str(user.id))
    fake_redis.set("job:job-123:result", "Done")
    fake_redis.set("job:job-123:tool_trace", json.dumps([...]))

    response = client.get("/api/agent/result/job-123", headers=...)

    assert response.json()["tool_trace"] == [...]
```

### Step 4 - Missing Trace Defaults Empty

Test:

```python
def test_job_result_defaults_tool_trace_to_empty_list(...):
    assert response.json()["tool_trace"] == []
```

### Step 5 - Frontend Type Test

If frontend wiring is included:

- update `frontend/src/api/agent.ts`,
- update `Message` in `useAgentChat`,
- add Vitest render test or API type coverage if practical.

## Implementation Plan

### Step 1 - Add Backend Schema

In `backend/app/schemas/agent.py`:

```python
from typing import Literal


class ToolTraceStep(BaseModel):
    tool: str
    status: Literal["success", "error"]
    summary: str
    error_code: str | None = None
```

Then update `JobResultResponse`.

### Step 2 - Add Trace Helper

In `backend/app/agent/tools/__init__.py`, add:

```python
def build_tool_trace_step(name: str, result: dict) -> dict:
    error_code = result.get("error")
    return {
        "tool": name,
        "status": "error" if error_code else "success",
        "summary": summarize_tool_result(result),
        "error_code": error_code,
    }
```

Use this helper in tests and in the runner.

### Step 3 - Update Runner Return Shape

Update `AgentRunner.run(...)` to return:

```python
{
    "message": final_text,
    "tool_trace": tool_trace,
}
```

For early returns and max-iteration fallback, return the same shape with `tool_trace`.

### Step 4 - Update Task Serialization

In `backend/app/tasks/agent_task.py`:

```python
import json
```

On success:

```python
run_result = execute_agent_job(...)
redis_client.set(f"job:{job_id}:result", run_result["message"], ex=JOB_TTL_SECONDS)
redis_client.set(
    f"job:{job_id}:tool_trace",
    json.dumps(run_result.get("tool_trace", [])),
    ex=JOB_TTL_SECONDS,
)
```

On failure:

```python
redis_client.set(f"job:{job_id}:tool_trace", "[]", ex=JOB_TTL_SECONDS)
```

### Step 5 - Update Result Endpoint

In `backend/app/api/agent.py`:

```python
import json
```

In `job_result(...)`:

```python
raw_trace = redis_client.get(f"job:{job_id}:tool_trace")
tool_trace = json.loads(raw_trace) if raw_trace else []
return {"job_id": job_id, "result": result, "tool_trace": tool_trace}
```

If JSON parsing fails, return an empty list rather than raising.

### Step 6 - Frontend Type Wiring

In `frontend/src/api/agent.ts`:

```ts
export interface ToolTraceStep {
  tool: string
  status: 'success' | 'error'
  summary: string
  error_code?: string | null
}

export interface JobResultResponse {
  job_id: string
  result: string
  tool_trace: ToolTraceStep[]
}
```

In `useAgentChat.ts`, add:

```ts
toolTrace?: ToolTraceStep[]
```

When result loads:

```ts
toolTrace: resultData.tool_trace
```

### Step 7 - UI Rendering

Since `ChatPage` is still placeholder, there are two options:

1. Backend-first: complete this story with API/schema/hook support only.
2. Full slice: implement minimal `ChatPage` rendering messages and tool traces.

Recommendation: use option 1 for this story if we want to keep scope tight, then make `ChatPage` a separate UI story. Use option 2 if we want the demo path to start becoming visible.

## Files To Touch

Expected backend files:

- `backend/app/schemas/agent.py`
- `backend/app/agent/tools/__init__.py`
- `backend/app/agent/runner.py`
- `backend/app/tasks/agent_task.py`
- `backend/app/api/agent.py`
- `backend/tests/agent/test_tool_logging.py` or new trace test
- `backend/tests/tasks/test_agent_task.py`
- `backend/tests/api/test_agent.py`
- `docs/PROJECT_PLAN.md`

Expected frontend files if UI/type wiring is included:

- `frontend/src/api/agent.ts`
- `frontend/src/hooks/useAgentChat.ts`
- possibly `frontend/src/pages/ChatPage.tsx`

Avoid touching:

- business behavior of tools,
- prompt content,
- auth behavior,
- leave/payroll service authorization rules.

## Acceptance Criteria

This story is done when:

- job result response includes `tool_trace`,
- no-tool jobs return `tool_trace: []`,
- failed jobs return `tool_trace: []`,
- tool-using jobs include one trace step per tool call,
- trace steps include tool name, success/error status, safe summary, and optional error code,
- traces do not include raw inputs or full outputs,
- frontend API types understand `tool_trace`,
- backend tests pass,
- frontend type-check passes if frontend files are changed,
- `docs/PROJECT_PLAN.md` marks `E4-S6` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent tests\tasks tests\api\test_agent.py
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

If frontend types are changed, from `frontend/`:

```bash
npm run type-check
npm test -- --run
```

If `npm` is unavailable in this environment, run the existing direct Node commands as we did for `E3-S8`.

## Commit Message

```text
E4-S6: return safe tool trace steps with agent results
```

## Next Story After This

Recommended next story:

**E4-S1/E4-S2/E4-S3 - verify the chat enqueue, status polling, and result retrieval flow as implemented stories.**

Those are currently scaffolded but now have enough behavior and tests to be reviewed honestly.
