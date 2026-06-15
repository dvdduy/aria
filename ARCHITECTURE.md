# AI HR Workflow Agent — Architecture Design

**Version:** 1.0  
**Status:** Draft  
**Architect:** Duy Dang  
**Last Updated:** June 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Design Principles](#2-design-principles)
3. [System Tiers](#3-system-tiers)
4. [Request Lifecycle (End-to-End)](#4-request-lifecycle-end-to-end)
5. [Component Design](#5-component-design)
6. [Data Architecture](#6-data-architecture)
7. [Agent Architecture](#7-agent-architecture)
8. [API Design](#8-api-design)
9. [Infrastructure Design](#9-infrastructure-design)
10. [Security Architecture](#10-security-architecture)
11. [Observability Design](#11-observability-design)
12. [Scalability & Failure Modes](#12-scalability--failure-modes)
13. [Technology Decision Log](#13-technology-decision-log)
14. [Folder Structure](#14-folder-structure)

---

## 1. Architecture Overview

The system is a **full-stack, async-first SaaS application** with an AI agent layer at its core. It is designed around one key constraint: **LLM tool-calling loops are slow** (5–15 seconds), so the architecture separates request acceptance (fast, synchronous) from agent execution (slow, asynchronous).

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT TIER                                                          │
│  React 18 + TypeScript · Chat UI · Dashboard · Polling               │
└──────────────────┬──────────────────────────────────┬────────────────┘
                   │ REST (JWT)                        │ Poll /status
┌──────────────────▼──────────────────────────────────▼────────────────┐
│  API TIER                                                             │
│  FastAPI  ·  JWT Auth  ·  Rate Limiting  ·  HR REST endpoints        │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ enqueue job
┌──────────────────▼───────────────────────────────────────────────────┐
│  QUEUE TIER                                                           │
│  Redis (broker + result cache)  ·  Celery worker pool                │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ run agent
┌──────────────────▼───────────────────────────────────────────────────┐
│  AGENT TIER                                                           │
│  AgentRunner (LLM tool-calling loop)  ·  Tool catalogue              │
│  ← LLM API calls (Anthropic / OpenAI) →                              │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ read / write
┌──────────────────▼───────────────────────────────────────────────────┐
│  DATA TIER                                                            │
│  PostgreSQL 15 (primary store)  ·  Redis (cache)  ·  Alembic        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Principles

### P1 — Async by default
No API endpoint blocks waiting for an LLM response. Every agent job is enqueued and polled. This ensures sub-500ms API responses regardless of how many tool calls the agent makes.

### P2 — Stateless services
FastAPI and Celery worker processes hold no in-memory state between requests. All state lives in PostgreSQL or Redis. This enables horizontal scaling — spin up more workers or API replicas without coordination.

### P3 — Minimal external dependencies
We own the full reasoning loop. No LangChain abstraction layer between our code and the LLM API. This means the tool-calling logic is transparent, debuggable, and portable across LLM providers.

### P4 — Defense in depth
Auth enforced at the API layer. Role-based access enforced at the service layer. Parameterised queries enforced at the ORM layer. No single point of permission failure.

### P5 — Fail safely and loudly
Every agent job has a timeout (30s), an iteration cap (10 calls), and a catch-all exception handler. Failures surface as friendly messages to the user and structured log entries for the operator — never raw stack traces.

### P6 — Observable from day one
Structured JSON logs on every request and every tool call. A `/health` endpoint for Kubernetes probes. A `/api/metrics` endpoint for operational visibility. These are not afterthoughts.

---

## 3. System Tiers

| Tier | Responsibility | Technology |
|------|---------------|------------|
| **Client** | User interface, chat interaction, polling | React 18, TypeScript, Tailwind CSS, React Query |
| **API** | HTTP routing, auth, validation, job enqueue | FastAPI, Pydantic, python-jose, slowapi |
| **Queue** | Async job management, worker dispatch | Celery, Redis |
| **Agent** | LLM reasoning loop, tool dispatch, memory | Custom AgentRunner, Anthropic SDK |
| **Data** | Persistent storage, migrations, caching | PostgreSQL 15, SQLAlchemy, Alembic, Redis |
| **Infra** | Container orchestration, CI/CD, secrets | Docker, Kubernetes, GitHub Actions |

---

## 4. Request Lifecycle (End-to-End)

This is the most important flow to understand. It is what makes the system production-grade rather than a demo.

### Step-by-step: "Approve Sarah's leave and notify her"

```
1.  USER        types message in React chat UI
2.  REACT       POST /api/agent/chat  { message, session_id }
                → FastAPI validates JWT, rate limit check passes
3.  FASTAPI     calls run_agent_task.delay(message, session_id, user_id)
                → Celery enqueues job in Redis
                → returns { job_id: "abc123" }  ← within 300ms
4.  REACT       renders "Thinking..." spinner, begins polling
                GET /api/agent/status/abc123  every 2s
5.  CELERY      worker picks up job from Redis queue
                → calls AgentRunner.run(...)
6.  AGENTRUNNER loads conversation history from agent_memory table
                appends new user message
                sends to LLM API with tool definitions
7.  LLM         responds: tool_use { name: "get_employee_info", input: { name: "Sarah" } }
8.  AGENTRUNNER calls get_employee_info("Sarah")
                → SELECT from employees table → returns { id, name, manager_id }
                appends tool_result to message history
9.  LLM         responds: tool_use { name: "get_leave_request", input: { employee_id } }
10. AGENTRUNNER calls get_leave_request(employee_id)
                → SELECT from leave_requests → returns pending request
11. LLM         responds: tool_use { name: "update_leave_status", input: { id, status: "approved" } }
12. AGENTRUNNER calls update_leave_status(...)
                → UPDATE leave_requests SET status='approved'
13. LLM         responds: tool_use { name: "send_notification", input: { employee_id, message } }
14. AGENTRUNNER calls send_notification(...)
                → INSERT into notifications
15. LLM         responds: text "Done. Sarah's leave (June 20–26) has been approved."
16. AGENTRUNNER saves final response to agent_memory
                writes result to Redis: { status: "done", result: "..." }
17. REACT       poll detects status="done"
                GET /api/agent/result/abc123
                renders final message in chat
```

**Why this matters architecturally:** Steps 2–4 complete in ~300ms. Steps 5–16 take 8–15 seconds. The async split means the user never waits on a blocking HTTP connection.

### Failure path

```
Any step 6–16 throws exception
    → AgentRunner catches, writes { status: "failed", error: "friendly message" }
    → REACT poll detects "failed", shows error in chat
    → Celery marks task FAILURE, logs structured error
    → NO raw traceback reaches the user
```

---

## 5. Component Design

### 5.1 FastAPI Application (`backend/app/main.py`)

```
FastAPI app
├── Middleware
│   ├── CORSMiddleware          (origins: [frontend URL])
│   ├── RequestLoggingMiddleware (structured JSON per request)
│   └── RateLimitMiddleware     (via slowapi, keyed by user_id)
├── Routers
│   ├── /api/auth               (register, login, refresh)
│   ├── /api/agent              (chat, status, result, history)
│   ├── /api/employees          (CRUD, admin-gated)
│   ├── /api/leave              (employee + manager views)
│   ├── /api/policies           (browse, search)
│   └── /api/payroll            (read-only summaries)
├── Dependencies
│   ├── get_db()                (SQLAlchemy session, yields, closes)
│   ├── get_current_user()      (decodes JWT, loads user from DB)
│   └── require_admin()         (checks is_admin flag)
└── Startup events
    └── verify DB connection on boot
```

### 5.2 AgentRunner (`backend/app/agent/runner.py`)

This is the most critical class. It owns the LLM tool-calling loop.

```python
class AgentRunner:
    MAX_ITERATIONS = 10
    TIMEOUT_SECONDS = 30

    def run(self, message: str, session_id: str, user_id: str, db: Session) -> str:
        # 1. Load history from agent_memory table
        history = self.load_history(session_id, db)

        # 2. Append new user message
        history.append({ "role": "user", "content": message })

        iterations = 0
        while iterations < self.MAX_ITERATIONS:
            # 3. Call LLM with tool definitions
            response = self.llm_client.messages.create(
                model="claude-sonnet-4-6",
                messages=history,
                tools=TOOL_DEFINITIONS
            )

            # 4. If final text response, done
            if response.stop_reason == "end_turn":
                final_text = response.content[0].text
                self.save_to_memory(session_id, "assistant", final_text, db)
                return final_text

            # 5. If tool call, execute and loop
            if response.stop_reason == "tool_use":
                for block in response.content:
                    if block.type == "tool_use":
                        result = self.dispatch_tool(block.name, block.input, db)
                        history.append({ "role": "assistant", "content": response.content })
                        history.append({
                            "role": "user",
                            "content": [{ "type": "tool_result", "tool_use_id": block.id, "content": str(result) }]
                        })

            iterations += 1

        return "I was unable to complete this task within the allowed number of steps. Please try a simpler request."
```

### 5.3 Tool Catalogue (`backend/app/agent/tools.py`)

Each tool is a plain Python function. The `TOOL_DEFINITIONS` list is the schema sent to the LLM.

```python
TOOL_DEFINITIONS = [
    {
        "name": "get_employee_info",
        "description": "Look up an employee by name or email address.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "Full or partial name" },
                "email": { "type": "string", "description": "Exact email address" }
            }
        }
    },
    # ... 7 more tool definitions
]

def dispatch_tool(name: str, inputs: dict, db: Session) -> dict:
    tools = {
        "get_employee_info":    lambda: get_employee_info(db, **inputs),
        "get_leave_request":    lambda: get_leave_request(db, **inputs),
        "submit_leave_request": lambda: submit_leave_request(db, **inputs),
        "update_leave_status":  lambda: update_leave_status(db, **inputs),
        "get_policy":           lambda: get_policy(db, **inputs),
        "get_payroll_summary":  lambda: get_payroll_summary(db, **inputs),
        "send_notification":    lambda: send_notification(db, **inputs),
        "list_team_leave":      lambda: list_team_leave(db, **inputs),
    }
    if name not in tools:
        return { "error": f"Unknown tool: {name}" }
    return tools[name]()
```

### 5.4 Celery Task (`backend/app/tasks/agent_task.py`)

```python
@celery.task(bind=True, acks_late=True, max_retries=2)
def run_agent_task(self, message: str, session_id: str, user_id: str):
    redis_client.set(f"job:{self.request.id}:status", "pending", ex=300)
    try:
        with get_db_context() as db:
            runner = AgentRunner()
            result = runner.run(message, session_id, user_id, db)
        redis_client.set(f"job:{self.request.id}:status", "done", ex=300)
        redis_client.set(f"job:{self.request.id}:result", result, ex=300)
    except Exception as e:
        logger.error("agent_task_failed", job_id=self.request.id, error=str(e))
        redis_client.set(f"job:{self.request.id}:status", "failed", ex=300)
        redis_client.set(f"job:{self.request.id}:result",
            "Something went wrong. Please try again.", ex=300)
```

---

## 6. Data Architecture

### 6.1 Entity Relationship Overview

```
users ──────────────── employees (1:1)
                           │
              ┌────────────┼────────────┐
              │            │            │
       leave_requests  payroll_records  │
              │                         │
       (approved_by FK)                 │
              │                         │
           employees (manager)          │
                                        │
                                   agent_memory
                                  (user_id FK)

hr_policies (standalone — no FK to employees)
```

### 6.2 Key Schema Decisions

**UUIDs as primary keys** — not auto-increment integers. Reason: UUIDs are safe to generate client-side, don't leak record counts, and are portable across database shards if we ever need them.

**Soft deletes on employees** — `is_active` boolean instead of `DELETE`. Reason: leave history and payroll records reference employee IDs. Hard deleting an employee would orphan all historical records.

**agent_memory as a first-class table** — not serialised into a Redis blob. Reason: conversation history is queryable (we can audit what the agent said), survives Redis restarts, and can be paginated for long sessions.

**Separate `users` and `employees` tables** — `users` holds auth credentials; `employees` holds HR data. Reason: clean separation of auth concerns from business data. An employee can exist without a login (e.g. before onboarding is complete).

### 6.3 Connection Pooling

```python
# SQLAlchemy engine config
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # persistent connections
    max_overflow=20,       # burst connections
    pool_pre_ping=True,    # test connections before use
    pool_recycle=3600,     # recycle connections every 1 hour
)
```

Each Celery worker gets its own connection pool. FastAPI uses a separate pool via the `get_db()` dependency.

### 6.4 Migration Strategy (Alembic)

- All schema changes go through Alembic migrations — no ad-hoc `ALTER TABLE` in production
- Migrations run automatically on container startup via `alembic upgrade head`
- All migrations are additive-first: add columns as nullable, backfill, then add constraints in a second migration
- Migration files are committed to version control and reviewed in CI

---

## 7. Agent Architecture

### 7.1 Why raw tool-calling over LangChain

LangChain (and LangGraph) are powerful but add abstraction over the LLM API's native tool-use protocol. For this project:

- We call the LLM API directly → we can see exactly what messages are sent
- Debugging is trivial — log the full message history at any step
- Switching LLM providers (Anthropic ↔ OpenAI) requires changing one API call, not re-learning a framework
- The tool-calling loop is ~60 lines of readable Python — any interviewer can follow it

### 7.2 Tool Safety Constraints

Every tool function enforces its own access control, not just the API layer:

```python
def get_leave_request(db: Session, employee_id: str, requesting_user: User) -> dict:
    # Check: user can only see their own requests, or requests of their reports
    employee = db.query(Employee).filter_by(id=employee_id).first()
    if not requesting_user.is_admin:
        if employee.id != requesting_user.employee_id:
            if employee.manager_id != requesting_user.employee_id:
                raise PermissionError("You cannot view this employee's leave requests.")
    # ... proceed with query
```

The agent cannot be prompted to bypass this — the permission check is in Python, not in the LLM's context.

### 7.3 Prompt Engineering

The system prompt sent with every agent invocation:

```
You are an HR assistant for [Company]. You help managers and employees with HR tasks.

Rules:
- Only take actions using the tools provided. Never invent data.
- If a tool returns empty results, say so clearly. Do not guess.
- Confirm actions before executing writes (approve, reject, notify) when ambiguous.
- Always cite which policy version you are referencing.
- If a request is outside your capabilities, say so and suggest contacting HR directly.
- Be concise. No preamble. Get to the answer.
```

### 7.4 Conversation Memory

```
Session flow:
  session_id is generated client-side on first message (UUID v4)
  All messages in a session share the same session_id

On each agent run:
  SELECT * FROM agent_memory WHERE session_id = ? ORDER BY created_at ASC
  → reconstruct message history
  → pass to LLM with new user message

After agent run:
  INSERT INTO agent_memory (role='user', content=user_message)
  INSERT INTO agent_memory (role='assistant', content=final_response)
  (tool calls are stored as role='tool_result' for debugging)
```

Memory is intentionally kept as a flat log — no summarisation in v1. For long sessions (>30 messages), the full history is truncated to the last 20 messages to stay within LLM context limits.

---

## 8. API Design

### 8.1 Agent Chat Endpoints

```
POST /api/agent/chat
  Body:    { message: string, session_id: string }
  Returns: { job_id: string }
  Auth:    JWT required
  Rate:    10 req/min per user

GET /api/agent/status/{job_id}
  Returns: { status: "pending" | "done" | "failed" }
  Auth:    JWT required

GET /api/agent/result/{job_id}
  Returns: { result: string, session_id: string }
  Auth:    JWT required

GET /api/agent/history/{session_id}
  Returns: { messages: [{ role, content, created_at }] }
  Auth:    JWT required
```

### 8.2 Error Response Shape

All errors return the same envelope — no status-code-hunting on the frontend:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You can send 10 messages per minute. Please wait before sending another.",
    "retry_after": 42
  }
}
```

### 8.3 Pagination

All list endpoints support cursor-based pagination:

```
GET /api/leave?cursor=<last_id>&limit=20
Returns: { items: [...], next_cursor: "uuid", has_more: true }
```

Offset pagination is avoided — it becomes inaccurate when records are inserted between pages.

---

## 9. Infrastructure Design

### 9.1 Docker Compose (Local)

```yaml
services:
  api:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/hr_agent
      REDIS_URL: redis://redis:6379/0
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [postgres, redis]

  worker:
    build: ./backend
    command: celery -A app.tasks.celery worker --loglevel=info
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    command: npm run dev
    ports: ["3000:3000"]

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: hr_agent
      POSTGRES_PASSWORD: postgres
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### 9.2 Kubernetes Architecture

```
Namespace: hr-agent
├── Deployments
│   ├── api-deployment         (2 replicas, liveness: GET /health)
│   ├── worker-deployment      (1–3 replicas, no liveness needed)
│   └── frontend-deployment    (2 replicas, Nginx)
├── StatefulSets
│   └── postgres-statefulset   (1 replica, PVC: 20Gi)
├── Services
│   ├── api-service            (ClusterIP :8000)
│   ├── frontend-service       (ClusterIP :80)
│   ├── postgres-service       (ClusterIP :5432)
│   └── redis-service          (ClusterIP :6379)
├── Ingress
│   └── main-ingress
│       ├── /api/* → api-service
│       └── /*    → frontend-service
├── ConfigMaps
│   └── app-config             (REDIS_URL, DATABASE_HOST, etc.)
└── Secrets
    └── app-secrets            (DB_PASSWORD, JWT_SECRET, ANTHROPIC_API_KEY)
```

### 9.3 Resource Limits (Kubernetes)

```yaml
resources:
  api:
    requests: { cpu: 250m, memory: 256Mi }
    limits:   { cpu: 500m, memory: 512Mi }
  worker:
    requests: { cpu: 500m, memory: 512Mi }
    limits:   { cpu: 1000m, memory: 1Gi }
  postgres:
    requests: { cpu: 250m, memory: 512Mi }
    limits:   { cpu: 500m, memory: 1Gi }
```

Worker gets more CPU than the API because it runs the LLM tool-calling loop (multiple HTTP calls, JSON parsing, DB queries in sequence).

### 9.4 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    steps:
      - ruff check backend/          # Python linting
      - mypy backend/app/            # type checking
      - eslint frontend/src/         # TypeScript linting
      - tsc --noEmit                 # TypeScript compile check

  test:
    steps:
      - pytest backend/tests/ --cov=app --cov-fail-under=70
      - vitest run frontend/src/

  build:
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    steps:
      - docker build -t ghcr.io/${{ github.repository }}/api:$SHA ./backend
      - docker build -t ghcr.io/${{ github.repository }}/frontend:$SHA ./frontend
      - docker push ...

  deploy:
    needs: [build]
    steps:
      - kubectl set image deployment/api api=ghcr.io/.../api:$SHA
      - kubectl set image deployment/frontend frontend=ghcr.io/.../frontend:$SHA
      - kubectl rollout status deployment/api
```

---

## 10. Security Architecture

### 10.1 Auth Flow

```
1. POST /api/auth/login { email, password }
   → FastAPI loads user from DB
   → bcrypt.verify(password, user.hashed_password)
   → generate JWT: { sub: user_id, exp: now+8h, is_admin: bool }
   → return { access_token, refresh_token }

2. Every subsequent request:
   Authorization: Bearer <access_token>
   → FastAPI middleware decodes JWT (python-jose)
   → loads user from DB (confirms still active)
   → injects into request as current_user dependency
```

### 10.2 Authorization Layers

| Layer | Mechanism |
|-------|-----------|
| Network | HTTPS only (TLS termination at Ingress) |
| API | JWT required on all routes except `/health` and `/api/auth/*` |
| Role | `require_admin()` dependency on admin-only routes |
| Data | Tool functions check manager-subordinate relationships before DB operations |
| DB | App uses a dedicated `hr_agent_app` Postgres user with no `CREATE`/`DROP` privileges |

### 10.3 Secret Management

```
Development: .env file (gitignored)
Production:  Kubernetes Secrets (base64-encoded, mounted as env vars)
             AWS: Secrets Manager (future — for rotation support)

Never in source code:
  - DATABASE_URL (contains password)
  - JWT_SECRET
  - ANTHROPIC_API_KEY
  - Any third-party API credentials
```

### 10.4 Input Validation

All API inputs validated by Pydantic models before any business logic runs:

```python
class SubmitLeaveRequest(BaseModel):
    leave_type: Literal["annual", "sick", "parental", "unpaid"]
    start_date: date
    end_date: date
    reason: str = Field(max_length=500)

    @validator("end_date")
    def end_after_start(cls, v, values):
        if "start_date" in values and v < values["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v
```

---

## 11. Observability Design

### 11.1 Structured Logging

Every log line is a JSON object. No string concatenation.

```json
{
  "timestamp": "2026-06-15T10:23:41Z",
  "level": "INFO",
  "service": "api",
  "event": "request_completed",
  "method": "POST",
  "path": "/api/agent/chat",
  "status_code": 200,
  "duration_ms": 187,
  "user_id": "uuid-...",
  "job_id": "abc123",
  "request_id": "req-xyz"
}
```

```json
{
  "timestamp": "2026-06-15T10:23:43Z",
  "level": "INFO",
  "service": "worker",
  "event": "tool_call_completed",
  "tool_name": "get_leave_request",
  "job_id": "abc123",
  "duration_ms": 12,
  "result_summary": "found 1 pending request"
}
```

### 11.2 Health Endpoint

```python
@app.get("/health")
async def health(db: Session = Depends(get_db)):
    # Check DB connectivity
    db.execute(text("SELECT 1"))
    # Check Redis connectivity
    redis_client.ping()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION
    }
```

Returns `503` if any dependency is unreachable — Kubernetes stops routing traffic to unhealthy pods.

### 11.3 Metrics Endpoint

```python
@app.get("/api/metrics")
async def metrics(current_user: User = Depends(require_admin)):
    return {
        "queue_depth": celery.control.inspect().active(),
        "jobs_last_5min": redis_client.get("metrics:jobs:5min"),
        "errors_last_5min": redis_client.get("metrics:errors:5min"),
        "avg_agent_duration_ms": redis_client.get("metrics:agent:avg_duration")
    }
```

---

## 12. Scalability & Failure Modes

### 12.1 Scaling Axes

| Component | How it scales | Bottleneck |
|-----------|--------------|------------|
| FastAPI API | Add replicas (stateless) | None — CPU/memory only |
| Celery workers | Add replicas (stateless, pull-based) | Redis throughput |
| Redis | Single instance (portfolio scope) | Memory; upgrade to Redis Cluster |
| PostgreSQL | Single primary (portfolio scope) | Connection pool exhaustion; upgrade to read replicas |
| LLM API | Rate limits from provider | Add retry with exponential backoff |

### 12.2 Failure Modes & Mitigations

| Failure | Impact | Mitigation |
|---------|--------|-----------|
| Celery worker crashes mid-job | Job lost | `acks_late=True` — job stays in queue until acknowledged on completion |
| Redis restarts | All pending jobs lost | Use Redis persistence (AOF) in production; jobs are idempotent so resubmission is safe |
| LLM API returns 429 (rate limit) | Agent fails | Celery retry with exponential backoff, max 2 retries |
| LLM API returns 500 | Agent fails | Same retry logic; graceful error message to user |
| PostgreSQL connection exhausted | All requests fail | Pool pre-ping + max_overflow cap; alert on pool saturation |
| Agent loop exceeds 10 iterations | Job stuck | Hard cap enforced in AgentRunner; returns timeout message |
| Frontend poll loses network | UI stalls | React Query retries with backoff; reconnect resumes polling |

### 12.3 Data Durability

```
PostgreSQL:
  - Docker volume for local dev (data survives container restarts)
  - Kubernetes PVC (20Gi) for production
  - Daily pg_dump backup (future: automated S3 snapshot)

Redis:
  - In-memory only for local dev
  - appendonly yes in production (AOF persistence)
  - Job results have 5-minute TTL — user expected to read before expiry
```

---

## 13. Technology Decision Log

### Why FastAPI over Django/Flask?

FastAPI offers native async support, automatic OpenAPI docs generation, and Pydantic integration for validation. Django is heavier than needed for a pure API. Flask requires more manual setup for type safety. FastAPI is also the framework most associated with Python AI/ML backends — directly relevant to Workday's preferred stack.

### Why Celery + Redis over FastAPI BackgroundTasks?

FastAPI's `BackgroundTasks` run in the same process as the web server. If the server restarts, in-flight tasks are lost. Celery workers are separate processes with their own lifecycle, job persistence, retry logic, and scaling controls. The cost is operational complexity — but demonstrating you chose Celery deliberately (and can explain why) is a senior engineering signal.

### Why PostgreSQL over MongoDB?

HR data is highly relational: employees have managers, leave requests reference employees, payroll records reference employees, agent memory references users. A document store would denormalise all of this, making queries like "show all pending leave for this manager's team" harder to express and slower to execute. PostgreSQL's foreign keys and JOIN performance are the right fit.

### Why raw Anthropic SDK over LangChain?

LangChain adds abstraction that obscures what's actually happening in the tool-calling loop. For a portfolio project, it's more impressive to demonstrate you understand the LLM API natively — how messages are structured, how tool results are fed back, how stop reasons work — than to wrap it in a framework. Raw SDK code is also more debuggable and more portable.

### Why polling over WebSockets?

WebSockets require stateful server connections, which complicate horizontal scaling. Polling at 2-second intervals is well within user tolerance for a task that takes 10–15 seconds. A 2s polling loop generates ~7 extra HTTP requests per agent job — negligible cost. WebSockets are the right v2 upgrade once the system is stable.

---

## 14. Folder Structure

```
ai-hr-agent/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py             # /api/auth/* endpoints
│   │   │   ├── agent.py            # /api/agent/* endpoints
│   │   │   ├── employees.py        # /api/employees/* endpoints
│   │   │   ├── leave.py            # /api/leave/* endpoints
│   │   │   ├── policies.py         # /api/policies/* endpoints
│   │   │   └── payroll.py          # /api/payroll/* endpoints
│   │   ├── agent/
│   │   │   ├── runner.py           # AgentRunner class (LLM loop)
│   │   │   ├── tools.py            # Tool functions + TOOL_DEFINITIONS
│   │   │   └── prompts.py          # System prompt templates
│   │   ├── models/
│   │   │   ├── employee.py         # SQLAlchemy ORM models
│   │   │   ├── leave.py
│   │   │   ├── policy.py
│   │   │   ├── payroll.py
│   │   │   ├── user.py
│   │   │   └── agent_memory.py
│   │   ├── schemas/
│   │   │   ├── auth.py             # Pydantic request/response schemas
│   │   │   ├── agent.py
│   │   │   ├── leave.py
│   │   │   └── employee.py
│   │   ├── services/
│   │   │   ├── auth_service.py     # bcrypt, JWT logic
│   │   │   ├── leave_service.py    # Business logic
│   │   │   └── notification_service.py
│   │   ├── tasks/
│   │   │   ├── celery.py           # Celery app init
│   │   │   └── agent_task.py       # run_agent_task definition
│   │   ├── core/
│   │   │   ├── config.py           # Settings from env vars
│   │   │   ├── database.py         # SQLAlchemy engine + session
│   │   │   ├── redis.py            # Redis client
│   │   │   └── logging.py          # Structured JSON logger
│   │   └── main.py                 # FastAPI app, middleware, routers
│   ├── alembic/
│   │   ├── versions/               # Migration files
│   │   └── env.py
│   ├── tests/
│   │   ├── test_auth.py
│   │   ├── test_agent_tools.py
│   │   ├── test_leave.py
│   │   └── conftest.py             # Fixtures (test DB, mock LLM)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx      # Message list + input
│   │   │   ├── MessageBubble.tsx   # Single message (user / agent)
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   └── LeaveTable.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ChatPage.tsx
│   │   │   ├── LeavePage.tsx
│   │   │   ├── TeamPage.tsx
│   │   │   ├── PoliciesPage.tsx
│   │   │   └── PayrollPage.tsx
│   │   ├── hooks/
│   │   │   ├── useAgentChat.ts     # Post message, poll status, fetch result
│   │   │   ├── useLeave.ts
│   │   │   └── useAuth.ts
│   │   ├── api/
│   │   │   ├── client.ts           # Axios instance with JWT injection
│   │   │   ├── agent.ts            # Agent endpoint functions
│   │   │   └── hr.ts               # HR endpoint functions
│   │   └── types/
│   │       └── api.ts              # TypeScript interfaces for all API shapes
│   ├── Dockerfile
│   └── package.json
├── k8s/
│   ├── api-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── postgres-statefulset.yaml
│   ├── redis-deployment.yaml
│   ├── ingress.yaml
│   ├── secrets.yaml                # Values replaced by CI/CD pipeline
│   └── configmap.yaml
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── README.md
├── ARCHITECTURE.md                 # ← this file
└── PRODUCT_REQUIREMENTS.md
```

---

*This document should be revisited after each milestone. Architecture decisions made under portfolio constraints (single Redis, single Postgres primary) should be noted when pitching this work in interviews — demonstrating awareness of production tradeoffs is part of the senior signal.*
