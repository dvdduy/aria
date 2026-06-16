# E4-S4 Conversation Session Memory

**Story:** As a user, I can maintain a conversation session.  
**Epic:** E4 - AI Agent Core  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

Aria should remember the prior turns in a chat session so a user can ask follow-up questions without restating context every time.

The rule:

```text
conversation history is scoped by authenticated user and session id
```

## Current State

Already implemented:

- `ChatRequest` accepts optional `session_id`.
- `POST /api/agent/chat` generates a session id when one is not provided.
- `AgentMemory` model exists with `user_id`, `session_id`, `role`, and `content`.
- `AgentRunner._load_history(...)` loads up to 40 records by `session_id` and `user_id`.
- `AgentRunner._save_to_memory(...)` saves assistant messages.

Current gap:

- user messages are appended to in-memory history but not saved to `AgentMemory`,
- tool results are sent to the model during one run but not persisted,
- session id validation is loose,
- tests do not prove history is user-scoped and session-scoped.

## Recommended Scope

Implement conversation memory for user and assistant turns.

For this story:

- save the user's new message before or during the run,
- continue saving assistant final messages,
- load only records for the same `user_id` and `session_id`,
- preserve the 40-message history limit,
- do not persist raw tool outputs yet unless needed for model continuity,
- do not add a frontend chat history UI yet.

Keep tool result persistence deferred. Tool outputs can include sensitive structured data, and we should design that carefully before storing it long-term.

## TDD Plan

Create:

```text
backend/tests/agent/test_runner_memory.py
```

### Step 1 - Save User And Assistant Messages

Test a smaller helper if mocking Anthropic is too heavy:

```python
def test_save_to_memory_persists_user_and_assistant_turns(db):
    runner = AgentRunner()

    runner._save_to_memory(session_id, str(user.id), "user", "Hello", db)
    runner._save_to_memory(session_id, str(user.id), "assistant", "Hi", db)

    history = runner._load_history(session_id, str(user.id), db)

    assert history == [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi"},
    ]
```

### Step 2 - History Is User Scoped

Test:

```python
def test_load_history_does_not_cross_users(db):
    # same session id, two users
    # save one message for each
    # load first user's history

    assert only first user's message is returned
```

### Step 3 - History Is Session Scoped

Test:

```python
def test_load_history_does_not_cross_sessions(db):
    # same user, two session ids
    # save one message in each
    # load first session

    assert only first session's message is returned
```

### Step 4 - Runner Saves Current User Turn

Best test:

- monkeypatch `runner.client.messages.create` to return an `end_turn` response,
- call `runner.run(...)`,
- assert `AgentMemory` contains the user message and assistant message.

If response mocking is awkward, add a helper:

```python
def _append_user_message(...)
```

and test that helper directly. Prefer testing `run(...)` if possible.

## Implementation Plan

### Step 1 - Save User Turn In Runner

In `backend/app/agent/runner.py`, after loading history and before appending the live message:

```python
self._save_to_memory(session_id, user_id, "user", message, db)
history = self._load_history(session_id, user_id, db)
```

Or:

```python
history = self._load_history(session_id, user_id, db)
history.append({"role": "user", "content": message})
self._save_to_memory(session_id, user_id, "user", message, db)
```

The second shape avoids the newly saved message being loaded twice during the same run.

### Step 2 - Keep Assistant Save

The current assistant save is good:

```python
self._save_to_memory(session_id, user_id, "assistant", final_text, db)
```

Keep it.

### Step 3 - Validate Session UUIDs Carefully

`_save_to_memory(...)` currently does:

```python
uuid.UUID(session_id) if isinstance(session_id, str) else session_id
```

That can raise if a caller passes an invalid session id.

Options:

1. Accept only UUID-shaped session ids in `ChatRequest`.
2. Keep string schema and return a safe API validation error later.

Recommendation for this story:

- do not expand scope into API validation,
- add tests using valid UUID strings,
- create a follow-up if invalid session ids become a problem.

### Step 4 - Do Not Persist Tool Results Yet

Tool results are currently added to the in-run model history:

```python
history.append({"role": "user", "content": tool_results})
```

Do not persist those in this story. Persisting tool results should be paired with a data retention decision.

## Files To Touch

Expected files:

- `backend/app/agent/runner.py`
- `backend/tests/agent/test_runner_memory.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- agent API routes,
- Celery task behavior,
- frontend chat UI,
- tool business behavior,
- `AgentMemory` database schema unless a test reveals a real schema issue.

## Acceptance Criteria

This story is done when:

- current user message is saved to `AgentMemory`,
- assistant response is saved to `AgentMemory`,
- `_load_history` returns prior turns in order,
- history is scoped by user id,
- history is scoped by session id,
- tests cover memory persistence and isolation,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E4-S4` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent\test_runner_memory.py
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
E4-S4: persist user turns in agent session memory
```

## Next Story After This

Recommended next story:

**E6-S1 - As a user, I can browse policy categories.**

That moves into policy data now that the core agent workflow is much better protected.
