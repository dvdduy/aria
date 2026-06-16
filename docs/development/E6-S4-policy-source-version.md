# E6-S4 Policy Source And Version

**Story:** As a user, policy answers identify the source policy and version.  
**Epic:** E6 - Policies  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

`E6-S3` lets the agent retrieve stored policy content. Now we need to make policy answers auditable enough for a user to know where the answer came from.

The goal:

```text
policy answers include the source policy title and version used by the agent
```

This is important because HR policy details can vary by version, effective date, and category. Even in a learning/demo app, the user should be able to see the basis for the answer.

## Current State

Already implemented:

- `get_policy` returns stored policy content from active `HRPolicy` records.
- The policy result includes `title`, `category`, `content`, `version`, and `effective_date`.
- The system prompt says: `Always cite the policy version when referencing HR policies.`
- Tool traces summarize policy lookups as `policy:<title>`.

Current gap:

- the source information is present inside `policy`, but not shaped as a clear source/citation contract,
- the tool definition does not explicitly tell the model to include source and version in the final answer,
- tests do not verify that policy lookup responses expose citation-ready metadata,
- there is no direct test that the system prompt preserves the policy source/version rule.

## Recommended Scope

Keep this story backend-only.

Add source metadata to `get_policy` results:

```json
{
  "tool": "get_policy",
  "policy": {
    "id": "policy-id",
    "title": "Annual Leave Policy",
    "category": "leave",
    "content": "Stored policy body...",
    "version": "v2.0",
    "effective_date": "2026-01-01"
  },
  "source": {
    "policy_id": "policy-id",
    "title": "Annual Leave Policy",
    "version": "v2.0",
    "effective_date": "2026-01-01"
  },
  "answer_guidance": "Use only the policy content above and cite Annual Leave Policy v2.0."
}
```

The `source` object gives the model an obvious citation payload. `answer_guidance` is intentionally small and deterministic.

Do not add:

- frontend citation UI,
- persisted audit tables,
- vector retrieval,
- multi-policy answer synthesis,
- admin policy version management.

## Design Decision

Keep source metadata in the tool result instead of trying to parse citations from final model text.

Why:

- deterministic tests can verify tool output,
- the LLM receives structured citation-ready metadata,
- `E6-S4` stays achievable without brittle natural-language assertions,
- future UI traces can show source metadata directly if needed.

We should still strengthen prompt/tool-definition wording, but the most reliable contract is the tool response shape.

## TDD Plan

Update:

```text
backend/tests/agent/test_policy_tools.py
backend/tests/agent/test_tool_logging.py
```

Create:

```text
backend/tests/agent/test_policy_prompt_contract.py
```

### Step 1 - Source Metadata Is Returned

Add to the existing category test or create a new one:

```python
def test_get_policy_returns_source_metadata(db):
    policy = HRPolicy(
        title="Annual Leave Policy",
        category="leave",
        content="Employees receive annual leave according to plan rules.",
        version="v2.0",
        effective_date=date(2026, 1, 1),
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)

    result = get_policy(db, _tool_context(db), category="leave")

    assert result["source"] == {
        "policy_id": str(policy.id),
        "title": "Annual Leave Policy",
        "version": "v2.0",
        "effective_date": "2026-01-01",
    }
```

Expected red result:

```text
KeyError: 'source'
```

### Step 2 - Answer Guidance References Source And Version

Test:

```python
assert result["answer_guidance"] == (
    "Use only the policy content above and cite Annual Leave Policy v2.0."
)
```

This is intentionally exact. It prevents the guidance from becoming vague over time.

### Step 3 - Source Metadata Handles Missing Effective Date

Test:

```python
policy = HRPolicy(..., effective_date=None)

assert result["source"]["effective_date"] is None
assert result["answer_guidance"] == (
    "Use only the policy content above and cite Annual Leave Policy v1.0."
)
```

### Step 4 - Tool Summary Can Include Version

Update summary behavior from:

```text
policy:Annual Leave Policy
```

to:

```text
policy:Annual Leave Policy:v2.0
```

Add/update test:

```python
assert summarize_tool_result(
    {"policy": {"title": "Annual Leave Policy", "version": "v2.0"}}
) == "policy:Annual Leave Policy:v2.0"
```

### Step 5 - Prompt Contract Test

Create:

```text
backend/tests/agent/test_policy_prompt_contract.py
```

Test:

```python
from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools.definitions import TOOL_DEFINITIONS


def test_system_prompt_requires_policy_source_and_version():
    assert "policy version" in SYSTEM_PROMPT
    assert "source policy" in SYSTEM_PROMPT


def test_get_policy_tool_definition_mentions_source_and_version():
    get_policy = next(tool for tool in TOOL_DEFINITIONS if tool["name"] == "get_policy")

    assert "source" in get_policy["description"].lower()
    assert "version" in get_policy["description"].lower()
```

Expected red result:

```text
AssertionError
```

## Implementation Plan

### Step 1 - Add Source Serializer

Update:

```text
backend/app/agent/tools/policy_tools.py
```

Add:

```python
def _serialize_policy_source(policy: HRPolicy) -> dict:
    return {
        "policy_id": str(policy.id),
        "title": policy.title,
        "version": policy.version,
        "effective_date": (
            policy.effective_date.isoformat() if policy.effective_date else None
        ),
    }
```

### Step 2 - Add Answer Guidance Helper

Add:

```python
def _build_answer_guidance(policy: HRPolicy) -> str:
    return f"Use only the policy content above and cite {policy.title} {policy.version}."
```

This wording is short enough for a tool result and clear enough for the model.

### Step 3 - Return Source And Guidance From Tool

Update `get_policy(...)` success response:

```python
return {
    "tool": "get_policy",
    "policy": _serialize_policy(policy),
    "source": _serialize_policy_source(policy),
    "answer_guidance": _build_answer_guidance(policy),
}
```

Keep existing error responses unchanged.

### Step 4 - Update Tool Summary

Update:

```text
backend/app/agent/tools/__init__.py
```

Recommended:

```python
if "policy" in result:
    policy = result["policy"]
    return f"policy:{policy.get('title', 'unknown')}:{policy.get('version', 'unknown')}"
```

This keeps logs/tool traces helpful without exposing policy body content.

### Step 5 - Strengthen Prompt Rule

Update:

```text
backend/app/agent/prompts.py
```

Replace:

```text
- Always cite the policy version when referencing HR policies.
```

With:

```text
- When answering from an HR policy, identify the source policy title and policy version.
```

Do not make a broad prompt rewrite in this story.

### Step 6 - Strengthen Tool Definition

Update:

```text
backend/app/agent/tools/definitions.py
```

Recommended `get_policy` description:

```text
Retrieve stored HR policy content by category or keyword. Use the returned source title and version in the final answer.
```

Also update keyword description to mention title or body content:

```text
Search term in policy title or body content
```

## Files To Touch

Expected files:

- `backend/app/agent/tools/policy_tools.py`
- `backend/app/agent/tools/__init__.py`
- `backend/app/agent/prompts.py`
- `backend/app/agent/tools/definitions.py`
- `backend/tests/agent/test_policy_tools.py`
- `backend/tests/agent/test_tool_logging.py`
- `backend/tests/agent/test_policy_prompt_contract.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- policy search API,
- frontend pages,
- database schema,
- agent job queue behavior,
- vector/RAG infrastructure.

## Acceptance Criteria

This story is done when:

- successful `get_policy` responses include `source`,
- `source` includes policy id, title, version, and effective date,
- successful `get_policy` responses include deterministic `answer_guidance`,
- missing effective dates are represented as `None`,
- policy tool summaries include title and version,
- the system prompt requires source policy title and version in policy answers,
- the `get_policy` tool definition tells the model to use returned source title and version,
- existing not-found and invalid-request behavior still passes,
- full agent tests pass,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E6-S4` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent\test_policy_tools.py tests\agent\test_policy_prompt_contract.py
.venv\Scripts\python.exe -m pytest tests\agent
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

Expected final result:

```text
pytest: all tests pass
ruff: All checks passed
```

Frontend checks are not required unless implementation touches frontend files.

## Commit Message

```text
E6-S4: include policy source and version in agent answers
```

## Next Story After This

Recommended next story:

**E6-S5 - As an admin, I can create and update policy content.**

That gives the policy area a basic content-management path after users and the agent can already discover and cite stored policies.
