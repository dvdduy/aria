# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aria is an AI HR workflow assistant — a learning/portfolio project with a React+Vite frontend and a FastAPI+Python backend. Employees, managers, and admins interact with an AI agent that can answer HR questions and execute workflows (leave requests, payroll lookups, policy search, etc.) through guarded tool calls.

## Commands

**Full local stack (recommended):**
```bash
docker compose up --build
# Frontend: http://localhost:5173
# API:      http://localhost:8000  (Swagger: /docs)
```

**Frontend only:**
```bash
cd frontend
npm install
npm run dev        # dev server
npm run lint       # ESLint
npm run type-check # tsc --noEmit
npm run test       # Vitest
```

**Backend only (outside Docker):**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Backend checks:**
```bash
ruff check backend/
mypy backend/app/
pytest backend/tests/          # all tests
pytest backend/tests/test_foo.py::test_bar  # single test
```

**Local dev seed accounts:**
- `admin@aria.dev` / `admin123`
- `manager@aria.dev` / `manager123`
- `employee@aria.dev` / `employee123`

## Architecture

### Async Agent Flow

The core of the system spans five files. Understanding this flow is necessary before touching agent or API code:

1. **`backend/app/api/agent.py`** — receives a chat message, enqueues a Celery task, and immediately returns a `job_id`.
2. **`frontend/src/hooks/useAgentChat.ts`** — polls `/api/agent/jobs/{job_id}` every 2 seconds until status is `done` or `failed`.
3. **`backend/app/tasks/agent_task.py`** — Celery task. Writes `job:{id}:status`, `job:{id}:result`, and `job:{id}:tool_trace` keys into Redis (5-min TTL).
4. **`backend/app/agent/runner.py`** — `AgentRunner.run()` loads conversation history from PostgreSQL (`AgentMemory`, last 40 turns), appends the new user message, then drives the Anthropic tool-use loop until `stop_reason == "end_turn"` or `agent_max_iterations` is reached. Each iteration may call tools and append results back to the message history.
5. **`backend/app/agent/tools/`** — tool dispatch layer:
   - `definitions.py` — `TOOL_DEFINITIONS` list sent to the Claude API on every call.
   - `__init__.py` — `dispatch_tool(name, input, db, context)` routes to the correct tool module.
   - `context.py` — `build_tool_context(db, user)` assembles a user-scoped context object injected into every tool call (roles, employee record, etc.).

### Database & Persistence

- **PostgreSQL** stores all domain data and conversation history (`AgentMemory`).
- **Redis** is used only for short-lived job state (status/result) — results expire in 5 minutes.
- Alembic runs migrations automatically on API startup; migration files live in `backend/alembic/versions/`.

### Auth

JWT-based. Tokens are injected by the Axios client (`frontend/src/api/`) and validated by FastAPI dependencies in `backend/app/core/security.py`. The `user_id` from the JWT is passed through to Celery tasks and then to `AgentRunner`, so the agent always runs in the context of the authenticated user.

### Frontend Data Fetching

React Query manages server state for all non-agent endpoints (leave, team, policies, payroll). The agent chat flow is handled separately by `useAgentChat` because it requires polling-based job status tracking rather than a standard query.

## Known Limitations

- The `send_notification` agent tool requires an `employee_id`, so the agent must obtain this from a prior lookup rather than resolving by name.
