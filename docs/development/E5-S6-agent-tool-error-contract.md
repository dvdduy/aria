# E5-S6 Agent Tool Error Contract

**Story:** As a user, unsupported tool requests return a clear not-implemented or not-authorized response.  
**Epic:** E5 - Safe Agent Tools  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

The agent now has several real tools, plus several tools that are still intentionally scaffolded. Before adding more behavior, we should make tool failures boring, structured, and safe.

The goal:

```text
every unsupported, unauthorized, invalid, or failed tool call returns a predictable safe response
```

This helps three consumers:

- the model, which needs clear tool results,
- the UI, which can later show tool traces,
- us as developers, because failures become easier to test and debug.

## Current State

Already implemented:

- `dispatch_tool(...)` returns `unknown_tool` for missing tools.
- `dispatch_tool(...)` returns `tool_failed` for unexpected exceptions.
- leave tools return `profile_not_linked`, `not_authorized`, `invalid_request`, and `not_found`.
- scaffolded tools return `not_implemented`.
- tests cover unknown tools and generic tool failures.

Current gaps:

- error helper functions are duplicated or local to each module,
- `not_implemented` responses are hand-written in different files,
- there is no central list of allowed agent tool error codes,
- `dispatch_tool(...)` currently exposes raw exception messages as `tool_failed`,
- tests do not prove all scaffolded tools return the same shape.

## Recommended Scope

Add a shared response helper module for agent tools.

Recommended file:

```text
backend/app/agent/tools/responses.py
```

Recommended helpers:

```python
unknown_tool(tool_name)
tool_failed(tool_name)
not_implemented(tool_name)
profile_not_linked(tool_name)
not_authorized(tool_name, message)
invalid_request(tool_name, message)
not_found(tool_name, message)
```

Then update existing tool modules to use those helpers.

Do not implement new business behavior in this story.

## Error Contract

Every tool error should return:

```json
{
  "error": "machine_readable_code",
  "tool": "tool_name",
  "message": "Safe user/model-facing explanation"
}
```

Recommended codes:

```text
unknown_tool
tool_failed
not_implemented
profile_not_linked
not_authorized
invalid_request
not_found
```

Keep messages safe:

- no stack traces,
- no database details,
- no environment values,
- no API keys,
- no raw exception type names,
- no SQL fragments.

For `tool_failed`, prefer a generic message:

```text
The tool failed while processing the request.
```

Log detailed exceptions separately later in `E5-S7`.

## TDD Plan

Update:

```text
backend/tests/agent/test_tool_dispatch.py
```

Create or update:

```text
backend/tests/agent/test_tool_responses.py
```

### Step 1 - Response Helper Tests

Test shape:

```python
def test_not_implemented_response_shape():
    assert not_implemented("send_notification") == {
        "error": "not_implemented",
        "tool": "send_notification",
        "message": "This agent tool is scaffolded but not implemented yet.",
    }
```

Add similar tests for:

- `unknown_tool`,
- `tool_failed`,
- `profile_not_linked`,
- `not_authorized`,
- `invalid_request`,
- `not_found`.

Expected red result:

```text
ModuleNotFoundError: No module named 'app.agent.tools.responses'
```

### Step 2 - Dispatch Uses Shared Unknown Tool Response

Update existing dispatch test:

```python
def test_dispatch_tool_returns_safe_error_for_unknown_tool(db, tool_context):
    result = dispatch_tool("missing_tool", {}, db, tool_context)

    assert result["error"] == "unknown_tool"
    assert result["tool"] == "missing_tool"
```

### Step 3 - Dispatch Uses Generic Tool Failure

Update existing failure test:

```python
def test_dispatch_tool_returns_generic_error_for_tool_failure(...):
    result = dispatch_tool("failing_tool", {}, db, tool_context)

    assert result == {
        "error": "tool_failed",
        "tool": "failing_tool",
        "message": "The tool failed while processing the request.",
    }
```

This prevents accidental leakage of raw exception text.

### Step 4 - Scaffolded Tools Return Consistent Not Implemented

Test remaining scaffolded tools:

```python
def test_scaffolded_tools_return_not_implemented(db, tool_context):
    assert submit_leave_request(db, tool_context)["error"] == "not_implemented"
    assert get_policy(db, tool_context)["error"] == "not_implemented"
    assert send_notification(db, tool_context)["error"] == "not_implemented"
```

## Implementation Plan

### Step 1 - Add Response Helper Module

Create:

```text
backend/app/agent/tools/responses.py
```

Recommended contents:

```python
def tool_error(code: str, tool_name: str, message: str) -> dict:
    return {
        "error": code,
        "tool": tool_name,
        "message": message,
    }


def unknown_tool(tool_name: str) -> dict:
    return tool_error("unknown_tool", tool_name, f"Unknown tool: {tool_name}")


def tool_failed(tool_name: str) -> dict:
    return tool_error(
        "tool_failed",
        tool_name,
        "The tool failed while processing the request.",
    )
```

Then add the remaining helpers.

### Step 2 - Update Dispatch

In `backend/app/agent/tools/__init__.py`:

```python
from app.agent.tools.responses import tool_failed, unknown_tool
```

Use:

```python
if not fn:
    return unknown_tool(name)
...
except Exception:
    return tool_failed(name)
```

Do not include raw exception text in the response. If useful, log the exception in `E5-S7`.

### Step 3 - Update Tool Modules

Replace local helpers in:

- `backend/app/agent/tools/leave_tools.py`
- `backend/app/agent/tools/employee_tools.py`
- `backend/app/agent/tools/payroll_tools.py`
- `backend/app/agent/tools/policy_tools.py`
- `backend/app/agent/tools/notification_tools.py`

Use shared helpers:

```python
from app.agent.tools.responses import (
    invalid_request,
    not_authorized,
    not_found,
    not_implemented,
    profile_not_linked,
)
```

Keep response behavior the same except for `tool_failed`, which should become generic.

### Step 4 - Keep Business Tests Green

Existing tests for leave/payroll/profile tool errors should continue to pass if helper messages match current strings.

The one intended test update:

- `tool_failed` no longer returns `"boom"` from a raised exception.

## Files To Touch

Expected files:

- `backend/app/agent/tools/responses.py`
- `backend/app/agent/tools/__init__.py`
- `backend/app/agent/tools/employee_tools.py`
- `backend/app/agent/tools/leave_tools.py`
- `backend/app/agent/tools/payroll_tools.py`
- `backend/app/agent/tools/policy_tools.py`
- `backend/app/agent/tools/notification_tools.py`
- `backend/tests/agent/test_tool_responses.py`
- `backend/tests/agent/test_tool_dispatch.py`
- possibly existing agent tool tests if expected messages change
- `docs/PROJECT_PLAN.md`

Avoid touching:

- tool business behavior,
- tool definitions,
- agent runner loop,
- frontend UI,
- database models.

## Acceptance Criteria

This story is done when:

- all tool error responses follow `{ error, tool, message }`,
- shared response helpers exist for known error codes,
- unknown tools return `unknown_tool`,
- scaffolded tools return `not_implemented`,
- unauthorized tools return `not_authorized`,
- unexpected exceptions return generic `tool_failed`,
- raw exception text is not returned to the model,
- tests cover response helpers and dispatch behavior,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E5-S6` as `Verified`.

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
E5-S6: standardize safe agent tool error responses
```

## Next Story After This

Recommended next story:

**E5-S7 - As an operator, every tool call is logged with tool name, user, and result summary.**

That gives us observability after the response contract is stable.
