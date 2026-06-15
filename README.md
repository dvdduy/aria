# Aria

Aria is an early-stage AI HR workflow assistant built to practice applied AI with a React frontend and Python backend. The product direction is inspired by Workday-style HR operations: employees and managers should be able to ask questions, submit requests, and complete routine HR workflows through a guarded AI assistant.

This project is currently a learning and portfolio project, not a production HR system.

## Current Stack

- Frontend: React, Vite, TypeScript, React Router, React Query, Axios
- Backend: FastAPI, SQLAlchemy, Pydantic, JWT auth
- AI agent: Anthropic Messages API with tool-calling scaffolding
- Async jobs: Celery and Redis
- Data: PostgreSQL locally through Docker Compose
- Deployment notes: Dockerfiles, docker-compose, Kubernetes plan

## Frontend Direction

Stay with Vite React for now. Next.js is useful when the app needs server-side rendering, file-based routing, SEO pages, server components, or integrated backend routes. Aria is mostly an authenticated internal dashboard, so Vite keeps the learning surface smaller and faster.

Use Vitest with the current frontend. Vitest is a test runner, not an alternative to Next.js. It fits Vite well and should cover hooks, API clients, form validation, and important user flows.

Recommended frontend plan:

1. Keep Vite React until there is a clear product reason to migrate.
2. Add Vitest and Testing Library tests for login, protected routes, chat polling, and leave forms.
3. Add end-to-end tests later with Playwright once the core flows stabilize.

## Local Development

Prerequisites:

- Docker Desktop
- Node.js and npm for local frontend development
- Python 3.12+ if running the backend outside Docker

Start the full local stack:

```bash
docker compose up --build
```

Expected local URLs:

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs in development

Development seed accounts are intended to exist for local demos:

- `admin@aria.dev` / `admin123`
- `manager@aria.dev` / `manager123`
- `employee@aria.dev` / `employee123`

Do not use these credentials outside local development.

## Current Limitations

- Several backend endpoints and agent tools are still placeholders.
- Agent tool execution needs user-scoped authorization before it can safely read or mutate HR data.
- Job status and result lookups should be tied to the requesting user.
- Backend tests are scaffolded but need meaningful assertions.
- Frontend lint configuration needs to be completed for ESLint 9.
- Top-level environment examples should be cleaned up for encoding and formatting.

## Portfolio Goals

This project can become a strong applied AI portfolio piece if it demonstrates:

- A practical HR workflow assistant rather than a generic chatbot.
- Guarded tool use with clear permission checks.
- A small but polished employee/manager/admin experience.
- Tests around the workflows where AI mistakes would matter.
- Clear documentation of tradeoffs, limitations, and next steps.

## Planning Docs

- [Product Requirements](PRODUCT_REQUIREMENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation Roadmap](ROADMAP.md)
- [Project Plan](docs/PROJECT_PLAN.md)
- [Interactive Design Mockup](docs/hr-agent-design-system.html)
