# E6-S3 Agent Policy Grounding

**Story:** As a user, I can ask the agent about a policy and receive a grounded answer.  
**Epic:** E6 - Policies  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

Aria should answer HR policy questions only from policy records stored in the app. This is the first policy-agent slice, so correctness matters more than broad conversational polish.

The goal:

```text
the agent can retrieve stored policy content and answer policy questions from that content only
```

This story should implement the policy lookup tool contract. It should not add admin policy editing, vector search, RAG pipelines, or complex source citation UI yet.

## Current State

Already implemented:

- `HRPolicy` model stores title, category, content, version, effective date, and active flag.
- `GET /api/policies/categories` lists active categories.
- `GET /api/policies` searches policy summaries by title and category.
- `get_policy` is already registered in `TOOL_MAP`.
- `get_policy` is already listed in `TOOL_DEFINITIONS`.
- The system prompt already says to use tool data only and not invent facts.

Current gap:

- `backend/app/agent/tools/policy_tools.py` still returns `not_implemented("get_policy")`.
- There is no service function that returns full policy content for the agent.
- Tool summaries do not yet recognize policy lookup results.
- There are no policy-agent tool tests.

## Recommended Scope

Implement `get_policy(...)` as a safe read-only tool.

Tool inputs already exist:

```json
{
  "category": "leave",
  "keyword": "annual"
}
```

Recommended behavior:

- search active policies only,
- match optional `category` against `HRPolicy.category`,
- match optional `keyword` against `HRPolicy.title` or `HRPolicy.content`,
- require at least one of `category` or `keyword`,
- return the best matching policy with full stored content,
- return a safe not-found response when nothing matches,
- never fabricate policy text.

Recommended success response:

```json
{
  "policy": {
    "id": "policy-id",
    "title": "Annual Leave Policy",
    "category": "leave",
    "content": "Stored policy body...",
    "version": "v1.0",
    "effective_date": "2026-01-01"
  }
}
```

Recommended not-found response:

```json
{
  "error": "not_found",
  "tool": "get_policy",
  "message": "No matching policy was found."
}
```

## Design Decision

Add a dedicated service function for agent lookup:

```text
find_policy_for_agent(db, category=None, keyword=None) -> HRPolicy | None
```

Keep it separate from `search_policies(...)`.

Why:

- `search_policies(...)` returns summaries for frontend discovery,
- the agent needs full stored content,
- the lookup rules can stay narrow and deterministic,
- later `E6-S4` can build source/version answer behavior on top of this response.

## TDD Plan

Create:

```text
backend/tests/agent/test_policy_tools.py
```

### Step 1 - Returns Stored Policy By Category

Test:

```python
def test_get_policy_returns_stored_policy_by_category(db, tool_context):
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

    result = get_policy(db, tool_context, category="leave")

    assert result["policy"]["id"] == str(policy.id)
    assert result["policy"]["title"] == "Annual Leave Policy"
    assert result["policy"]["content"] == policy.content
    assert result["policy"]["version"] == "v2.0"
    assert result["policy"]["effective_date"] == "2026-01-01"
```

Expected red result:

```text
AssertionError: result contains error:not_implemented
```

### Step 2 - Returns Stored Policy By Keyword

Test:

```python
result = get_policy(db, tool_context, keyword="annual")

assert result["policy"]["title"] == "Annual Leave Policy"
```

### Step 3 - Searches Content As Well As Title

Test:

```python
result = get_policy(db, tool_context, keyword="carryover")

assert result["policy"]["content"] == policy.content
```

### Step 4 - Ignores Inactive Policies

Test:

```python
inactive_policy = HRPolicy(..., is_active=False)

result = get_policy(db, tool_context, category="leave")

assert result["error"] == "not_found"
```

### Step 5 - Requires A Lookup Input

Test:

```python
result = get_policy(db, tool_context)

assert result["error"] == "invalid_tool_input"
```

If `invalid_tool_input` does not exist yet in `responses.py`, add it there using the same safe error contract as other tool responses.

### Step 6 - Tool Summary Handles Policy Results

Update:

```text
backend/tests/agent/test_tool_logging.py
```

Add:

```python
assert summarize_tool_result({"policy": {"title": "Annual Leave Policy"}}) == (
    "policy:Annual Leave Policy"
)
```

If you want to avoid logging titles, use `"policy_returned"` instead. For this learning project, policy titles are usually safe and useful.

## Implementation Plan

### Step 1 - Add Service Lookup

Update:

```text
backend/app/services/policy_service.py
```

Recommended shape:

```python
from sqlalchemy import or_, select


def find_policy_for_agent(
    db: Session,
    category: str | None = None,
    keyword: str | None = None,
) -> HRPolicy | None:
    statement = select(HRPolicy).where(HRPolicy.is_active.is_(True))

    normalized_category = category.strip() if category else ""
    normalized_keyword = keyword.strip() if keyword else ""

    if normalized_category:
        statement = statement.where(HRPolicy.category.ilike(normalized_category))

    if normalized_keyword:
        pattern = f"%{normalized_keyword}%"
        statement = statement.where(
            or_(
                HRPolicy.title.ilike(pattern),
                HRPolicy.content.ilike(pattern),
            )
        )

    statement = statement.order_by(HRPolicy.category.asc(), HRPolicy.title.asc())
    return db.execute(statement).scalars().first()
```

### Step 2 - Add Safe Response Helper

Update:

```text
backend/app/agent/tools/responses.py
```

Recommended helper if missing:

```python
def invalid_tool_input(tool: str, message: str) -> dict:
    return {
        "error": "invalid_tool_input",
        "tool": tool,
        "message": message,
    }
```

Use existing helpers if the file already has an equivalent.

### Step 3 - Implement Policy Tool

Update:

```text
backend/app/agent/tools/policy_tools.py
```

Recommended serializer:

```python
def _serialize_policy(policy: HRPolicy) -> dict:
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "content": policy.content,
        "version": policy.version,
        "effective_date": policy.effective_date.isoformat()
        if policy.effective_date
        else None,
    }
```

Recommended tool:

```python
def get_policy(
    db: Session,
    context: ToolContext,
    category: str | None = None,
    keyword: str | None = None,
    **kwargs,
) -> dict:
    if not (category and category.strip()) and not (keyword and keyword.strip()):
        return invalid_tool_input(
            "get_policy",
            "Provide a policy category or keyword.",
        )

    policy = find_policy_for_agent(db, category=category, keyword=keyword)
    if not policy:
        return {
            "error": "not_found",
            "tool": "get_policy",
            "message": "No matching policy was found.",
        }

    return {"policy": _serialize_policy(policy)}
```

The `context` parameter may be unused in this story. Keep it in the signature because all tools share the trusted context contract.

### Step 4 - Update Tool Summary

Update:

```text
backend/app/agent/tools/__init__.py
```

Add policy handling to `summarize_tool_result(...)`:

```python
if "policy" in result:
    return f"policy:{result['policy'].get('title', 'unknown')}"
```

This improves tool traces and logs after a successful policy lookup.

### Step 5 - Optional Runner-Level Test

Most of this story can be covered at the tool layer. If you want one integration-style test, patch `Anthropic` responses in a runner test to simulate:

1. model requests `get_policy`,
2. tool returns stored policy content,
3. model returns a final answer using that content.

This is helpful but not required if tool tests are strong. The runner has already been covered by previous stories.

## Files To Touch

Expected files:

- `backend/app/agent/tools/policy_tools.py`
- `backend/app/agent/tools/responses.py`
- `backend/app/agent/tools/__init__.py`
- `backend/app/services/policy_service.py`
- `backend/tests/agent/test_policy_tools.py`
- `backend/tests/agent/test_tool_logging.py`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- frontend policy page,
- policy admin flows,
- vector/RAG infrastructure,
- prompt rewrites beyond tiny wording if absolutely needed.

## Acceptance Criteria

This story is done when:

- `get_policy` returns stored active policy content for a category match,
- `get_policy` returns stored active policy content for a keyword/title match,
- `get_policy` can match keyword against policy content,
- inactive policies are ignored,
- missing lookup input returns a safe tool error,
- no matching policy returns a clear not-found tool response,
- policy lookup results include title, category, content, version, and effective date,
- tool trace/log summaries recognize successful policy results,
- tests cover found and not-found policy lookups,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E6-S3` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\agent\test_policy_tools.py
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
E6-S3: ground agent policy answers in stored policies
```

## Next Story After This

Recommended next story:

**E6-S4 - As a user, policy answers identify the source policy and version.**

That story should strengthen the answer contract around citations and policy version visibility after this tool can already retrieve stored content.
