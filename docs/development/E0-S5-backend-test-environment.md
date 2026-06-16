# E0-S5 Backend Test Environment

**Story:** As a developer, I can run backend tests locally without depending on secret production-like environment variables.  
**Epic:** E0 - Project Foundation  
**Priority:** P0  
**Recommended first implementation task:** Yes

## Why This Comes First

The next major work is auth, leave permissions, and safe agent tools. Those are high-risk areas because mistakes can leak or mutate HR data. Before building them, the backend needs a test environment that:

- starts without real secrets,
- does not call a real LLM provider,
- uses an isolated test database,
- can be reset between tests,
- supports FastAPI `TestClient`,
- gives us a place to test permission failures.

This is not glamorous work, but it is the floor we stand on.

## Current Problem

`app.core.config` creates settings immediately:

```python
settings = Settings()
```

That means importing `app.main` requires these env vars to exist:

- `DATABASE_URL`
- `JWT_SECRET`
- `ANTHROPIC_API_KEY`

The current `tests/conftest.py` imports `app.main` at module import time, before test-specific setup can reliably control settings. This makes tests fragile and too dependent on local `.env`.

## Design Goal

Keep production settings strict, but make tests explicit and predictable.

The clean target design:

```text
tests
  set safe env vars before importing app.main
  create isolated SQLite engine
  override get_db dependency
  create/drop tables around the test session
  provide TestClient fixture
  add first smoke/auth tests
```

We do **not** need to redesign the whole settings system yet. A small fixture-level setup is enough for the first task.

## Files To Touch

Expected files:

- `backend/tests/conftest.py`
- `backend/tests/api/test_health.py`
- `backend/tests/api/test_auth.py`
- optionally `backend/app/services/auth_service.py`
- optionally `backend/pyproject.toml`

Avoid touching:

- agent runner behavior,
- LLM client behavior,
- Celery task behavior,
- frontend code.

## Implementation Plan

### Step 1 - Set Test Env Before App Import

In `tests/conftest.py`, set env vars before importing `app.main` or `app.core.database`.

Pattern:

```python
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
```

Then import app modules.

Why: Pydantic settings are evaluated at import time, so test env must exist first.

### Step 2 - Use A Test Database Engine

Keep the current SQLite strategy, but make the URL a test constant.

Recommended first pass:

```python
TEST_DATABASE_URL = "sqlite:///./test.db"
```

Later, we can improve this to a temp file or in-memory SQLite with shared connection pooling.

Acceptance:

- Tables are created for the test session.
- Tables are dropped after the test session.
- Each test gets a database session.
- FastAPI uses the test session through `app.dependency_overrides[get_db]`.

### Step 3 - Import All Models Before `create_all`

Before `Base.metadata.create_all`, make sure models are imported.

Pattern:

```python
from app import models  # noqa: F401
```

Why: SQLAlchemy only creates tables registered in metadata.

### Step 4 - Add Health Smoke Test

Create `backend/tests/api/test_health.py`.

Test goal:

- FastAPI app imports.
- `GET /health` returns a valid response shape.

Important note: current `/health` checks real DB and Redis clients, so in tests it may return `degraded`. That is okay for the first smoke test.

Acceptance:

```python
def test_health_returns_status(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"healthy", "degraded"}
    assert "version" in body
    assert "checks" in body
```

### Step 5 - Add Auth Service Tests

Create or fill `backend/tests/services/test_auth_service.py`.

Test the service directly first because it is faster and avoids route details.

Minimum tests:

1. `register_user` creates a user and returns a token.
2. `login_user` returns a token for valid credentials.
3. `login_user` returns `None` for invalid password.

Acceptance:

- Password stored in DB is not plaintext.
- Token response has `access_token` and `token_type`.
- Invalid password does not authenticate.

### Step 6 - Add Auth API Smoke Tests

Create or fill `backend/tests/api/test_auth.py`.

Minimum tests:

1. `POST /api/auth/register` returns `201`.
2. `POST /api/auth/login` returns `200` after registration.
3. `POST /api/auth/login` returns `401` for wrong password.

Do not overbuild duplicate-email handling yet unless you want to combine it with E1-S3. It is okay to discover that duplicate registration needs a follow-up story.

### Step 7 - Run Tests

Command from `backend/`:

```bash
pytest
```

If dependencies are not installed:

```bash
pip install -r requirements.txt
pytest
```

Expected result:

- tests collect,
- app imports without real secrets,
- smoke/auth tests pass.

## Suggested `conftest.py` Shape

```python
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401
from app.core.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

## Important Design Notes

### Keep LLM Calls Out Of Tests

This first task should not instantiate `AgentRunner` or call the Anthropic SDK. When agent tests arrive, mock the client.

### Avoid Testing Implementation Details Too Early

For the first pass, test behavior:

- can register,
- can login,
- invalid password fails,
- app imports,
- health route responds.

Do not test private helper internals unless needed.

### Keep Duplicate Email As A Follow-Up

Current `register_user` does not handle duplicate emails gracefully. That belongs to `E1-S3`. It is okay for this task to create the test foundation first, then harden auth next.

## Acceptance Criteria For E0-S5

This story is done when:

- `pytest` can start without relying on a real `.env`.
- The app imports in test mode.
- Test database tables are created and dropped in the test lifecycle.
- At least one API smoke test passes.
- At least one auth service or API test passes.
- No real LLM provider is called.
- `docs/PROJECT_PLAN.md` marks `E0-S5` as `Implemented` or `Verified`.

## Pairing Checklist

Use this checklist while implementing:

- [ ] Set test env vars before app imports.
- [ ] Ensure all models are imported before `create_all`.
- [ ] Override `get_db` in `TestClient`.
- [ ] Add health smoke test.
- [ ] Add auth service tests.
- [ ] Add auth API tests.
- [ ] Run `pytest`.
- [ ] Update project plan status.

## Next Story After This

After E0-S5, move to:

**E1-S3 - As a user, I cannot register the same email twice.**

That story should add duplicate email handling to `register_user`, route-level error behavior, and tests that prove the API returns a clean conflict response.
