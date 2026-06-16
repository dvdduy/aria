# E6-S1 Policy Categories

**Story:** As a user, I can browse policy categories.  
**Epic:** E6 - Policies  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

Policies are the first knowledge area where Aria needs to behave like a trustworthy HR assistant instead of a generic chatbot. Before the agent answers policy questions, users need a simple way to see what policy categories exist in the system.

The goal:

```text
authenticated users can open the Policies page and browse active policy categories from backend data
```

This is a small read-only vertical slice. It proves the policy model, API route, frontend API client, and page can work together before adding search, policy detail views, admin editing, or agent-grounded answers.

## Current State

Already implemented:

- `HRPolicy` model exists in `backend/app/models/policy.py`.
- `policies.router` is mounted at `/api/policies`.
- `HRPolicy` frontend type exists in `frontend/src/types/models.ts`.
- `/policies` frontend route exists.

Current gap:

- `backend/app/api/policies.py` is empty except for the router.
- There is no policy service layer.
- There is no policy schema.
- `frontend/src/pages/PoliciesPage.tsx` is a placeholder.
- There is no frontend API wrapper for policies.
- There are no policy API tests.

## Recommended Scope

Add category browsing only.

Backend behavior:

- `GET /api/policies/categories`
- requires the current authenticated user,
- returns unique active policy categories,
- sorts categories alphabetically,
- ignores inactive policies,
- returns an empty list when no active policies exist.

Recommended response shape:

```json
{
  "categories": ["conduct", "leave", "payroll"]
}
```

Frontend behavior:

- `PoliciesPage` fetches categories from the backend,
- shows a loading state,
- shows an error state if the request fails,
- shows an empty state when there are no active categories,
- renders category controls or simple category rows from real API data.

Keep this story intentionally narrow. Do not add policy search, policy body display, admin creation, or agent policy answering yet.

## Design Decision

Use a service function for category lookup:

```text
backend/app/services/policy_service.py
```

Recommended function:

```python
def list_policy_categories(db: Session) -> list[str]:
    ...
```

Why:

- the API route stays thin,
- later agent policy tools can reuse policy lookup logic,
- tests can cover the query separately if needed,
- `E6-S2` search and `E6-S3` agent policy grounding will have a clear place to grow.

## TDD Plan

Start backend-first.

Create:

```text
backend/tests/api/test_policies.py
```

### Step 1 - Auth Required

Test:

```python
def test_policy_categories_requires_auth(client):
    response = client.get("/api/policies/categories")

    assert response.status_code == 401
```

Expected red result:

```text
404 Not Found
```

or:

```text
status code is not 401
```

### Step 2 - Categories Are Unique And Sorted

Create several active policies with duplicate categories:

```python
def test_list_policy_categories_returns_unique_sorted_categories(client, auth_headers, db):
    db.add_all([
        HRPolicy(title="Payroll Basics", category="payroll", content="...", is_active=True),
        HRPolicy(title="Leave Basics", category="leave", content="...", is_active=True),
        HRPolicy(title="Leave Advanced", category="leave", content="...", is_active=True),
    ])
    db.commit()

    response = client.get("/api/policies/categories", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"categories": ["leave", "payroll"]}
```

Expected red result:

```text
404 Not Found
```

### Step 3 - Inactive Policies Are Hidden

Test:

```python
def test_list_policy_categories_ignores_inactive_policies(client, auth_headers, db):
    db.add(HRPolicy(title="Old Conduct", category="conduct", content="...", is_active=False))
    db.commit()

    response = client.get("/api/policies/categories", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"categories": []}
```

### Step 4 - Frontend API Test

If frontend API tests already have a local pattern, add:

```text
frontend/src/api/policies.test.ts
```

Test that:

- `getPolicyCategories()` calls `/api/policies/categories`,
- it returns `categories`.

If the current frontend test setup makes axios mocking awkward, keep this as a TypeScript compile check and cover behavior with page-level tests later.

## Implementation Plan

### Step 1 - Add Backend Schema

Create:

```text
backend/app/schemas/policy.py
```

Recommended schema:

```python
from pydantic import BaseModel


class PolicyCategoriesResponse(BaseModel):
    categories: list[str]
```

### Step 2 - Add Policy Service

Create:

```text
backend/app/services/policy_service.py
```

Recommended query:

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.policy import HRPolicy


def list_policy_categories(db: Session) -> list[str]:
    categories = db.execute(
        select(HRPolicy.category)
        .where(HRPolicy.is_active.is_(True))
        .distinct()
        .order_by(HRPolicy.category.asc())
    ).scalars()

    return list(categories)
```

### Step 3 - Add API Route

Update:

```text
backend/app/api/policies.py
```

Recommended route:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.policy import PolicyCategoriesResponse
from app.services.policy_service import list_policy_categories

router = APIRouter()


@router.get("/categories", response_model=PolicyCategoriesResponse)
def get_policy_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PolicyCategoriesResponse:
    return PolicyCategoriesResponse(categories=list_policy_categories(db))
```

The `current_user` parameter is intentionally present even if unused. It makes the endpoint private to authenticated Aria users.

### Step 4 - Add Frontend API Wrapper

Create:

```text
frontend/src/api/policies.ts
```

Recommended shape:

```ts
import client from './client'

export interface PolicyCategoriesResponse {
  categories: string[]
}

export async function getPolicyCategories(): Promise<PolicyCategoriesResponse> {
  const response = await client.get<PolicyCategoriesResponse>('/api/policies/categories')
  return response.data
}
```

### Step 5 - Update Policies Page

Update:

```text
frontend/src/pages/PoliciesPage.tsx
```

Recommended states:

- `categories: string[]`
- `isLoading: boolean`
- `error: string | null`

Keep layout work-focused:

- page title,
- short category toolbar or grid,
- no marketing hero,
- no fake categories,
- no policy content area until `E6-S2` or later.

Suggested UI copy:

- loading: `Loading policy categories...`
- empty: `No active policy categories found.`
- error: `Policy categories could not be loaded.`

### Step 6 - Consider Seed Data Separately

Do not require seed data for this story to pass. Tests should create their own policies.

If the local demo experience feels empty, add a follow-up story or seed script update after the API and page are working.

## Files To Touch

Expected files:

- `backend/app/api/policies.py`
- `backend/app/schemas/policy.py`
- `backend/app/services/policy_service.py`
- `backend/tests/api/test_policies.py`
- `frontend/src/api/policies.ts`
- `frontend/src/pages/PoliciesPage.tsx`
- `docs/PROJECT_PLAN.md`

Optional files:

- `frontend/src/types/models.ts`
- `frontend/src/api/policies.test.ts`

Avoid touching:

- agent policy tools,
- seed data,
- policy admin flows,
- policy search,
- payroll or leave behavior.

## Acceptance Criteria

This story is done when:

- authenticated users can call `GET /api/policies/categories`,
- unauthenticated users receive `401`,
- response contains unique active categories only,
- response categories are sorted alphabetically,
- no active policies returns an empty categories list,
- `PoliciesPage` loads categories from the backend,
- `PoliciesPage` handles loading, empty, and error states,
- backend tests cover auth, unique/sorted categories, inactive filtering, and empty result,
- TypeScript compile passes,
- frontend build passes,
- full backend tests pass,
- Ruff passes,
- `docs/PROJECT_PLAN.md` marks `E6-S1` as `Verified`.

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
E6-S1: add policy category browsing
```

## Next Story After This

Recommended next story:

**E6-S2 - As a user, I can search policy titles and categories.**

That builds naturally on this endpoint by adding a list/search API and turning the Policies page from category browsing into actual policy discovery.
