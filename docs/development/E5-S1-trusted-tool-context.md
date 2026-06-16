# E5-S1 Trusted Tool Context

**Story:** As the backend, every tool receives a trusted tool context containing user and employee identity.  
**Epic:** E5 - Safe Agent Tools  
**Priority:** P0  
**Recommended next implementation task:** Yes

## Why This Matters

This is the foundation for safe AI tool use in Aria.

The model can suggest tool inputs, but it must not decide who the user is, which employee record they own, or whether they are allowed to act as a manager. That identity and authorization context must come from backend-authenticated state.

The rule for this story:

```text
tool functions may read model inputs, but they must receive trusted identity from backend context
```

This story does not need to implement real employee, leave, payroll, or policy tools yet. It creates the contract that future tools will use safely.

## Current State

Current flow:

- `backend/app/agent/runner.py` receives `user_id` in `AgentRunner.run(...)`.
- The runner passes model tool input directly to `dispatch_tool(block.name, block.input, db)`.
- `backend/app/agent/tools/__init__.py` calls tools as `fn(db=db, **inputs)`.
- Tool modules are mostly explicit `not_implemented` stubs.
- Tool definitions currently expose sensitive identity inputs such as:
  - `employee_id`,
  - `manager_id`,
  - `approved_by`.

Current risk:

- Future tools could accidentally trust model-supplied `employee_id`.
- A model could request another employee's payroll or leave data if tool code does not independently check access.
- `approved_by` and `manager_id` should come from authenticated context, not model input.

## Recommended Scope

Add a small context layer:

```text
ToolContext
```

Recommended fields:

```python
user: User
employee: Employee | None
is_admin: bool
```

Then update dispatch:

```text
dispatch_tool(name, inputs, db, context)
```

And update all tool stubs:

```text
tool_name(db, context, **kwargs)
```

Keep tool behavior scaffolded. The done state for this story is that all tools receive context and tests prove model-provided identity cannot override the trusted context contract.

## Design Decision

Use a dataclass for the first implementation:

```python
from dataclasses import dataclass

from app.models.employee import Employee
from app.models.user import User


@dataclass(frozen=True)
class ToolContext:
    user: User
    employee: Employee | None
    is_admin: bool
```

Recommended file:

```text
backend/app/agent/tools/context.py
```

Why dataclass:

- simple,
- typed,
- easy to construct in tests,
- avoids introducing a framework dependency,
- communicates that context is backend-owned data.

## TDD Plan

### Step 1 - Context Builder Test

Create:

```text
backend/tests/agent/test_tool_context.py
```

Test shape:

```python
def test_build_tool_context_includes_user_and_employee(db):
    # create user
    # create employee linked to user

    context = build_tool_context(db, user)

    assert context.user.id == user.id
    assert context.employee.id == employee.id
    assert context.is_admin is False
```

Expected red result:

```text
ImportError: cannot import name 'build_tool_context'
```

### Step 2 - Admin Context Test

Add:

```python
def test_build_tool_context_marks_admin(db):
    user = User(email="admin@example.com", hashed_password="x", is_admin=True)

    context = build_tool_context(db, user)

    assert context.is_admin is True
```

### Step 3 - Unlinked User Test

Add:

```python
def test_build_tool_context_allows_unlinked_user(db):
    user = User(email="user@example.com", hashed_password="x")

    context = build_tool_context(db, user)

    assert context.employee is None
```

Unlinked users should not crash context construction. Individual tools can later return a safe not-authorized or profile-not-linked response.

### Step 4 - Dispatch Passes Context Test

Create:

```text
backend/tests/agent/test_tool_dispatch.py
```

Recommended test:

```python
def test_dispatch_tool_passes_trusted_context(monkeypatch, db):
    captured = {}

    def fake_tool(db, context, **kwargs):
        captured["context"] = context
        captured["kwargs"] = kwargs
        return {"ok": True}

    monkeypatch.setitem(TOOL_MAP, "fake_tool", fake_tool)

    context = ToolContext(user=user, employee=employee, is_admin=False)
    result = dispatch_tool("fake_tool", {"employee_id": "model-value"}, db, context)

    assert result == {"ok": True}
    assert captured["context"].employee.id == employee.id
    assert captured["kwargs"] == {"employee_id": "model-value"}
```

This confirms the tool receives model inputs separately from trusted backend identity.

### Step 5 - Unknown Tool Test

Add:

```python
def test_dispatch_tool_returns_safe_error_for_unknown_tool(db):
    result = dispatch_tool("missing_tool", {}, db, context)

    assert result["error"] == "unknown_tool"
```

Prefer structured error codes over freeform strings because the model and UI can handle them more reliably.

## Implementation Plan

### Step 1 - Add Context Module

Create:

```text
backend/app/agent/tools/context.py
```

Recommended contents:

```python
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.user import User
from app.services.employee_service import get_employee_for_user


@dataclass(frozen=True)
class ToolContext:
    user: User
    employee: Employee | None
    is_admin: bool


def build_tool_context(db: Session, user: User) -> ToolContext:
    return ToolContext(
        user=user,
        employee=get_employee_for_user(db, user),
        is_admin=user.is_admin,
    )
```

### Step 2 - Update Dispatch Signature

In `backend/app/agent/tools/__init__.py`:

```python
def dispatch_tool(name: str, inputs: dict, db, context: ToolContext) -> dict:
    fn = TOOL_MAP.get(name)
    if not fn:
        return {
            "error": "unknown_tool",
            "tool": name,
            "message": f"Unknown tool: {name}",
        }
    try:
        return fn(db=db, context=context, **inputs)
    except Exception as exc:
        return {
            "error": "tool_failed",
            "tool": name,
            "message": str(exc),
        }
```

This is not final production observability, but it gives every caller a consistent response shape.

### Step 3 - Update Tool Stubs

Update all tool modules so each function accepts context:

```python
def get_employee_info(db: Session, context: ToolContext, **kwargs) -> dict:
    return _not_implemented("get_employee_info")
```

Expected files:

- `backend/app/agent/tools/employee_tools.py`
- `backend/app/agent/tools/leave_tools.py`
- `backend/app/agent/tools/payroll_tools.py`
- `backend/app/agent/tools/policy_tools.py`
- `backend/app/agent/tools/notification_tools.py`

The stubs do not need to use context yet. The signature is the important contract.

### Step 4 - Update Agent Runner

In `backend/app/agent/runner.py`, load the authenticated user from `user_id`, build context, then dispatch with it.

Recommended approach:

```python
from app.agent.tools.context import build_tool_context
from app.models.user import User

user = db.query(User).filter(User.id == user_id).first()
if not user:
    return "I could not verify your account for this request."

tool_context = build_tool_context(db, user)
```

Then:

```python
result = dispatch_tool(block.name, block.input, db, tool_context)
```

Keep this logic near the start of `run(...)`, before the model loop.

### Step 5 - Revisit Tool Definitions Carefully

Do not remove model input fields in this story unless it breaks current prompts.

But add comments or follow-up notes that these fields are not trusted:

- `employee_id` may identify the requested target but must be checked against `context.employee`.
- `manager_id` should be removed later and inferred from `context.employee`.
- `approved_by` should be removed later and inferred from `context.employee`.

The safer schema cleanup can happen when implementing `E5-S2` and `E5-S3`.

## Files To Touch

Expected files:

- `backend/app/agent/tools/context.py`
- `backend/app/agent/tools/__init__.py`
- `backend/app/agent/runner.py`
- `backend/app/agent/tools/employee_tools.py`
- `backend/app/agent/tools/leave_tools.py`
- `backend/app/agent/tools/payroll_tools.py`
- `backend/app/agent/tools/policy_tools.py`
- `backend/app/agent/tools/notification_tools.py`
- `backend/tests/agent/test_tool_context.py`
- `backend/tests/agent/test_tool_dispatch.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- real leave tool behavior,
- real payroll tool behavior,
- Anthropic tool definitions beyond comments or minor doc text,
- frontend chat UI,
- Celery or Redis job ownership.

## Acceptance Criteria

This story is done when:

- `ToolContext` exists and contains authenticated user identity.
- `ToolContext` includes the linked employee when one exists.
- `ToolContext` marks admin users.
- `dispatch_tool` requires context and passes it to every tool.
- all tool stubs accept context.
- unknown tools return a structured safe error.
- tool failures return a structured safe error.
- `AgentRunner` builds context from backend-loaded user data.
- tests cover context building and dispatch context passing.
- full backend tests pass.
- Ruff passes.
- `docs/PROJECT_PLAN.md` marks `E5-S1` as `Verified`.

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
E5-S1: pass trusted identity context to agent tools
```

## Next Story After This

Recommended next story:

**E5-S2 - As an employee, agent tools can read my own profile and leave data.**

That will be the first real safe read tool using the context contract from this story.
