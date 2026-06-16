# E6-S2 Policy Search

**Story:** As a user, I can search policy titles and categories.  
**Epic:** E6 - Policies  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

`E6-S1` lets users see what policy categories exist. The next useful step is discovery: users should be able to find policies by title or category before we ask the agent to answer grounded policy questions.

The goal:

```text
authenticated users can search active policy summaries by title and category
```

This story should expose policy metadata, not full policy body content. Full content and agent-grounded answers belong in the next stories.

## Current State

Already implemented:

- `HRPolicy` model exists with `title`, `category`, `content`, `version`, `effective_date`, and `is_active`.
- `GET /api/policies/categories` returns active category names.
- `PoliciesPage` fetches and displays real categories.
- Policy API and page tests exist.

Current gap:

- there is no endpoint for listing/searching policy records,
- the frontend page cannot search by title or category,
- policy body content is not yet intentionally scoped for display,
- there is no policy summary response schema.

## Recommended Scope

Add a policy summary search endpoint:

```text
GET /api/policies?query=<text>
```

Recommended behavior:

- requires an authenticated user,
- searches active policies only,
- matches case-insensitively against `title` and `category`,
- returns all active policies when `query` is omitted or blank,
- sorts results by category, then title,
- returns policy summaries only.

Recommended response item:

```json
{
  "id": "policy-id",
  "title": "Annual Leave Policy",
  "category": "leave",
  "version": "v1.0",
  "effective_date": "2026-01-01"
}
```

Do not include `content` in this story. That keeps the policy discovery UI lightweight and saves the source-grounded answer work for `E6-S3` and `E6-S4`.

## Design Decision

Add a reusable service function:

```text
search_policies(db: Session, query: str | None = None) -> list[HRPolicy]
```

Put search logic in `backend/app/services/policy_service.py`, next to `list_policy_categories(...)`.

Use SQLAlchemy query building rather than filtering in Python so the behavior remains realistic as data grows.

## TDD Plan

Update:

```text
backend/tests/api/test_policies.py
```

### Step 1 - Auth Required

Test:

```python
def test_policy_search_requires_auth(client):
    response = client.get("/api/policies")

    assert response.status_code == 403
```

The project currently uses FastAPI `HTTPBearer`, which returns `403` when no auth header is present.

### Step 2 - Blank Query Returns Active Summaries

Test:

```python
def test_policy_search_returns_active_policy_summaries(client, db):
    active = HRPolicy(
        title="Annual Leave Policy",
        category="leave",
        content="Full body should not be returned",
        version="v2.0",
        effective_date=date(2026, 1, 1),
    )
    inactive = HRPolicy(
        title="Old Leave Policy",
        category="leave",
        content="Old body",
        is_active=False,
    )
    db.add_all([active, inactive])
    db.commit()

    response = client.get("/api/policies", headers=_auth_headers_for_user(db))

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(active.id),
            "title": "Annual Leave Policy",
            "category": "leave",
            "version": "v2.0",
            "effective_date": "2026-01-01",
        }
    ]
```

### Step 3 - Query Searches Title And Category

Test title search:

```python
response = client.get("/api/policies?query=annual", headers=headers)
```

Test category search:

```python
response = client.get("/api/policies?query=payroll", headers=headers)
```

Assert each returns only the matching active policy summaries.

### Step 4 - Query Is Case-Insensitive

Test:

```python
response = client.get("/api/policies?query=LEAVE", headers=headers)
```

Assert it matches a `leave` category or title.

### Step 5 - Empty Search Result

Test:

```python
response = client.get("/api/policies?query=missing", headers=headers)

assert response.status_code == 200
assert response.json() == []
```

## Implementation Plan

### Step 1 - Add Summary Schema

Update:

```text
backend/app/schemas/policy.py
```

Add:

```python
class PolicySummaryResponse(BaseModel):
    id: str
    title: str
    category: str
    version: str
    effective_date: date | None
```

Remember to import `date` from `datetime`.

### Step 2 - Add Search Service

Update:

```text
backend/app/services/policy_service.py
```

Recommended shape:

```python
from sqlalchemy import or_, select


def search_policies(db: Session, query: str | None = None) -> list[HRPolicy]:
    statement = select(HRPolicy).where(HRPolicy.is_active.is_(True))

    normalized_query = query.strip() if query else ""
    if normalized_query:
        pattern = f"%{normalized_query}%"
        statement = statement.where(
            or_(
                HRPolicy.title.ilike(pattern),
                HRPolicy.category.ilike(pattern),
            )
        )

    statement = statement.order_by(HRPolicy.category.asc(), HRPolicy.title.asc())
    return list(db.execute(statement).scalars())
```

SQLite supports SQLAlchemy's `ilike(...)` by lowering both sides, so this should work in tests and local development.

### Step 3 - Add Serializer And Endpoint

Update:

```text
backend/app/api/policies.py
```

Add:

```python
@router.get("", response_model=list[PolicySummaryResponse])
def search_policy_summaries(
    query: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return [_serialize_policy_summary(policy) for policy in search_policies(db, query)]
```

Recommended serializer:

```python
def _serialize_policy_summary(policy: HRPolicy) -> dict:
    return {
        "id": str(policy.id),
        "title": policy.title,
        "category": policy.category,
        "version": policy.version,
        "effective_date": policy.effective_date,
    }
```

### Step 4 - Add Frontend Types And API Method

Update:

```text
frontend/src/api/policies.ts
frontend/src/types/models.ts
```

Recommended model:

```ts
export interface HRPolicySummary {
  id: string
  title: string
  category: string
  version: string
  effective_date: string | null
}
```

Recommended API:

```ts
async searchPolicies(query = '') {
  const { data } = await client.get<HRPolicySummary[]>('/api/policies', {
    params: query.trim() ? { query } : undefined,
  })
  return data
}
```

Add an API test for both blank and nonblank query calls.

### Step 5 - Update Policies Page

Update:

```text
frontend/src/pages/PoliciesPage.tsx
```

Recommended page behavior:

- load categories and policy summaries together,
- show a search input above results,
- filter through the backend API,
- debounce is optional; a submit/search button is simpler for this story,
- keep category cards visible,
- render matching policy summaries below categories.

Suggested view props:

```ts
policies: HRPolicySummary[]
searchQuery: string
onSearchQueryChange: (value: string) => void
onSearch: () => void
```

Expected UI states:

- loading: `Loading policies...`
- empty initial result: `No active policies found.`
- empty filtered result: `No policies match this search.`
- error: `Policies could not be loaded.`

Do not render `content` yet.

## Files To Touch

Expected files:

- `backend/app/api/policies.py`
- `backend/app/schemas/policy.py`
- `backend/app/services/policy_service.py`
- `backend/tests/api/test_policies.py`
- `frontend/src/api/policies.ts`
- `frontend/src/api/policies.test.ts`
- `frontend/src/pages/PoliciesPage.tsx`
- `frontend/src/pages/PoliciesPage.test.tsx`
- `frontend/src/styles/components.css`
- `frontend/src/types/models.ts`
- `docs/PROJECT_PLAN.md`

Avoid touching:

- agent policy tools,
- policy body rendering,
- admin policy creation,
- seed data unless the demo experience explicitly needs it.

## Acceptance Criteria

This story is done when:

- authenticated users can call `GET /api/policies`,
- unauthenticated users cannot search policies,
- blank query returns active policy summaries,
- inactive policies are hidden,
- search matches title and category,
- search is case-insensitive,
- no-match search returns an empty list,
- response summaries do not include `content`,
- `PoliciesPage` can search policies and render summary results,
- loading, empty, and error states remain covered,
- backend policy tests pass,
- full backend tests pass,
- Ruff passes,
- TypeScript compile passes,
- Vitest passes,
- frontend build passes,
- `docs/PROJECT_PLAN.md` marks `E6-S2` as `Verified`.

## Verification

From `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests\api\test_policies.py
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
```

From `frontend/`:

```bash
C:\Users\duyd\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\typescript\bin\tsc --noEmit
C:\Users\duyd\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\vitest\vitest.mjs --run
C:\Users\duyd\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe .\node_modules\vite\bin\vite.js build
```

Expected final result:

```text
pytest: all tests pass
ruff: All checks passed
tsc: no errors
vitest: all tests pass
vite build: completed successfully
```

## Commit Message

```text
E6-S2: add policy summary search
```

## Next Story After This

Recommended next story:

**E6-S3 - As a user, I can ask the agent about a policy and receive a grounded answer.**

That should build on this search service by adding a policy lookup tool that returns stored policy content to the agent with strict found/not-found behavior.
