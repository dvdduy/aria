# Aria — AI HR Workflow Assistant

A portfolio project demonstrating an AI-powered HR assistant. Employees, managers, and admins interact with a Claude-backed agent that answers HR questions and executes guarded workflows (leave requests, payroll lookups, policy search, team management).

**Implemented today:** JWT auth with role-scoped agent tools, leave submit/approve/notify, policy and payroll lookup, team calendar, Docker Compose local stack, and CI.  
**Planned later:** hosted demo, Kubernetes manifests, Playwright E2E, RAG-style policy search. See [ROADMAP.md](ROADMAP.md).

---

## Demo

Walk the seeded flows in [DEMO.md](DEMO.md) (employee leave → manager approval via chat).  
UI direction: [docs/hr-agent-design-system.html](docs/hr-agent-design-system.html).  
Demo GIF/screenshots are planned but not bundled in this release.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript, React Router v6, React Query, Axios |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, JWT auth |
| AI agent | Anthropic Messages API — tool-calling loop with guarded dispatch |
| Async jobs | Celery + Redis (job polling, 5-min TTL) |
| Database | PostgreSQL (Docker); SQLite for tests |
| Rate limiting | slowapi — 10 requests/min per authenticated user |
| Containerisation | Docker Compose (full local stack) |

---

## Features

- **Conversational HR agent** — ask questions or execute workflows in plain English
- **Leave workflow** — submit, approve, reject with in-app notifications
- **Role-based access** — employee / manager / admin scopes enforced at every tool call
- **Team calendar** — visual monthly view of all approved and pending leave
- **Policy search** — agent answers questions grounded in stored HR policies
- **Payroll lookup** — employees can query their own pay history; admins see all
- **Session history** — past conversations are persisted and resumable
- **Per-user rate limiting** — agent chat capped at 10 requests / minute

---

## Local Development

**Prerequisites:** Docker Desktop (frontend and backend run inside Compose)

```bash
# Start everything
docker compose up --build

# Frontend  → http://localhost:5173
# API       → http://localhost:8000
# API docs  → http://localhost:8000/docs
```

**Seed accounts**

| Role | Email | Password |
|---|---|---|
| Admin | admin@aria.dev | admin123 |
| Manager | manager@aria.dev | manager123 |
| Employee | employee@aria.dev | employee123 |

**Reset the database**

```bash
docker compose down -v && docker compose up --build
```

---

## Running Tests

```bash
# Backend (inside Docker)
docker compose run --rm api pytest tests/ -q

# Frontend
cd frontend && npm test
```

---

## Architecture Overview

The agent flow spans five files:

1. **`backend/app/api/agent.py`** — enqueues a Celery task, returns `job_id` immediately
2. **`frontend/src/hooks/useAgentChat.ts`** — polls `/api/agent/jobs/{job_id}` every 2 s
3. **`backend/app/tasks/agent_task.py`** — Celery task; writes status/result to Redis
4. **`backend/app/agent/runner.py`** — drives the Anthropic tool-use loop (max 40 turns of history, configurable iteration cap)
5. **`backend/app/agent/tools/`** — tool definitions, dispatch, and user-scoped context

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for the full feature roadmap and story status.

---

## Known Limitations

- `send_notification` tool requires an `employee_id`, so the agent must resolve it via a prior lookup rather than by name.
- No end-to-end Playwright tests yet — agent flows are covered by backend integration tests and frontend unit tests.
- Cloud deployment is planned but not yet configured.
