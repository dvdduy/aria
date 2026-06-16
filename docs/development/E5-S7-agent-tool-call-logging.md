# E5-S7 Agent Tool Call Logging

**Story:** As an operator, every tool call is logged with tool name, user, and result summary.  
**Epic:** E5 - Safe Agent Tools  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

Aria now has real agent tools that can read employee data, read payroll data, and update leave requests. That means we need an operator-friendly trace of what the backend executed.

The goal:

```text
every agent tool call emits a structured, safe log event
```

This helps with:

- debugging agent behavior,
- proving backend authorization was involved,
- investigating failed tool calls,
- building future UI tool traces.

This story should use structured logs, not a persisted audit table. A database-backed audit trail can be added later if the product needs compliance-grade retention.

## Current State

Already implemented:

- `structlog` is configured in `backend/app/core/logging.py`.
- `AgentRunner` logs `tool_called`.
- `dispatch_tool(...)` returns standardized responses.
- `ToolContext` contains trusted user and employee identity.
- Agent tests cover tool dispatch and safe response shapes.

Current gap:

- the existing `tool_called` log only includes tool name and session id,
- result outcome is not logged,
- user id and employee id are not logged,
- there is no safe result summary helper,
- unexpected tool failures are converted to `tool_failed` but not logged with useful context.

## Recommended Scope

Add structured logging at the dispatch layer.

For each tool call, log:

- `event`: `agent_tool_called`,
- `tool`,
- `user_id`,
- `employee_id`,
- `is_admin`,
- `result_status`: `success` or `error`,
- `error_code`: when result has `error`,
- `summary`: safe one-line result summary.

Avoid logging:

- full tool inputs,
- full tool outputs,
- payroll amounts,
- freeform user message text,
- exception stack traces in this story,
- secrets or environment values.

## Design Decision

Put logging in `dispatch_tool(...)`, not `AgentRunner`.

Why:

- every tool call already flows through dispatch,
- dispatch has access to `ToolContext`,
- dispatch sees both the tool name and result,
- future non-runner tool execution will still be logged.

Keep `AgentRunner` focused on model loop orchestration.

## Safe Summary Rules

Add a helper:

```text
summarize_tool_result(result: dict) -> str
```

Recommended behavior:

- if `result["error"]` exists, return `"error:<code>"`,
- if `employee` exists, return `"employee_profile_returned"`,
- if `leave_requests` exists, return `"leave_requests:<count>"`,
- if `leave_request` exists, return `"leave_request:<status>"`,
- if `payroll_records` exists, return `"payroll_records:<count>"`,
- otherwise return `"success"`.

This intentionally avoids logging sensitive record details.

## TDD Plan

Update:

```text
backend/tests/agent/test_tool_dispatch.py
```

Create:

```text
backend/tests/agent/test_tool_logging.py
```

### Step 1 - Summary Helper Tests

Test shape:

```python
def test_summarize_tool_result_counts_collections():
    assert summarize_tool_result({"leave_requests": [{}, {}]}) == "leave_requests:2"
    assert summarize_tool_result({"payroll_records": [{}]}) == "payroll_records:1"
```

Add:

```python
def test_summarize_tool_result_handles_errors():
    assert summarize_tool_result({"error": "not_authorized"}) == "error:not_authorized"
```

Expected red result:

```text
ImportError: cannot import name 'summarize_tool_result'
```

### Step 2 - Dispatch Logs Successful Tool Call

Use `monkeypatch` against the module-level logger:

```python
def test_dispatch_tool_logs_success(monkeypatch, db, tool_context):
    events = []

    class FakeLogger:
        def info(self, event, **kwargs):
            events.append((event, kwargs))

    monkeypatch.setattr(agent_tools, "logger", FakeLogger())
    monkeypatch.setitem(agent_tools.TOOL_MAP, "fake_tool", lambda db, context: {"ok": True})

    dispatch_tool("fake_tool", {}, db, tool_context)

    assert events == [
        (
            "agent_tool_called",
            {
                "tool": "fake_tool",
                "user_id": str(tool_context.user.id),
                "employee_id": str(tool_context.employee.id),
                "is_admin": False,
                "result_status": "success",
                "error_code": None,
                "summary": "success",
            },
        )
    ]
```

### Step 3 - Dispatch Logs Error Result

Test:

```python
def test_dispatch_tool_logs_error_result(...):
    monkeypatch.setitem(
        agent_tools.TOOL_MAP,
        "fake_tool",
        lambda db, context: {"error": "not_authorized", "tool": "fake_tool", "message": "..."},
    )

    dispatch_tool("fake_tool", {}, db, tool_context)

    assert events[0][1]["result_status"] == "error"
    assert events[0][1]["error_code"] == "not_authorized"
    assert events[0][1]["summary"] == "error:not_authorized"
```

### Step 4 - Dispatch Logs Unknown Tool

Test:

```python
def test_dispatch_tool_logs_unknown_tool(...):
    result = dispatch_tool("missing_tool", {}, db, tool_context)

    assert result["error"] == "unknown_tool"
    assert events[0][1]["tool"] == "missing_tool"
    assert events[0][1]["error_code"] == "unknown_tool"
```

## Implementation Plan

### Step 1 - Import Logger In Tool Dispatch

In `backend/app/agent/tools/__init__.py`:

```python
from app.core.logging import logger
```

### Step 2 - Add Summary Helper

In the same file, add:

```python
def summarize_tool_result(result: dict) -> str:
    if error_code := result.get("error"):
        return f"error:{error_code}"
    if "employee" in result:
        return "employee_profile_returned"
    if "leave_requests" in result:
        return f"leave_requests:{len(result['leave_requests'])}"
    if "leave_request" in result:
        return f"leave_request:{result['leave_request'].get('status', 'unknown')}"
    if "payroll_records" in result:
        return f"payroll_records:{len(result['payroll_records'])}"
    return "success"
```

### Step 3 - Add Log Helper

Recommended:

```python
def log_tool_result(name: str, result: dict, context: ToolContext) -> None:
    error_code = result.get("error")
    logger.info(
        "agent_tool_called",
        tool=name,
        user_id=str(context.user.id),
        employee_id=str(context.employee.id) if context.employee else None,
        is_admin=context.is_admin,
        result_status="error" if error_code else "success",
        error_code=error_code,
        summary=summarize_tool_result(result),
    )
```

### Step 4 - Call Logger For Every Dispatch Path

In `dispatch_tool(...)`:

```python
if not fn:
    result = unknown_tool(name)
    log_tool_result(name, result, context)
    return result

try:
    result = fn(db=db, context=context, **inputs)
except Exception:
    result = tool_failed(name)

log_tool_result(name, result, context)
return result
```

### Step 5 - Remove Duplicate Runner Log

In `backend/app/agent/runner.py`, remove:

```python
logger.info("tool_called", tool=block.name, session_id=session_id)
```

The dispatch log is richer and avoids duplicate events. Keep `agent_done`.

## Files To Touch

Expected files:

- `backend/app/agent/tools/__init__.py`
- `backend/app/agent/runner.py`
- `backend/tests/agent/test_tool_dispatch.py`
- `backend/tests/agent/test_tool_logging.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- tool business behavior,
- tool response helpers,
- database models,
- frontend tool trace UI,
- persisted audit tables.

## Acceptance Criteria

This story is done when:

- every dispatched tool emits `agent_tool_called`,
- logs include tool name, user id, employee id, admin flag, result status, error code, and safe summary,
- unknown tools are logged,
- tool failures are logged without raw exception text,
- summaries do not include payroll amounts or full record payloads,
- duplicate runner-level `tool_called` log is removed,
- tests cover success, error, unknown tool, and summary behavior,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E5-S7` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent
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
E5-S7: log safe agent tool call summaries
```

## Next Story After This

Recommended next story:

**E4-S7 - As the backend, agent jobs are scoped to the user who created them.**

That closes an important security gap in the async job polling flow before we polish chat traces.
