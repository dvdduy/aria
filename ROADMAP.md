# Aria Implementation Roadmap

This roadmap keeps the project honest while the product documentation stays aspirational. Use it to tell what is built, what is scaffolded, and what is intentionally planned for later.

## Status Legend

| Status | Meaning |
| --- | --- |
| Implemented | Works in the app today and should be kept passing. |
| Scaffolded | File structure or UI exists, but behavior is incomplete. |
| Planned | Product and technical direction is chosen, but implementation has not started. |
| Deferred | Explicitly out of the current learning/MVP scope. |

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| React app shell | Implemented | Vite, React Router, pages, layout, shared UI components. |
| Design tokens | Implemented | Tokens are aligned with the interactive mockup in `docs/hr-agent-design-system.html`. |
| Auth API | Scaffolded | Register/login service exists; needs duplicate-email handling, refresh-token decision, and stronger tests. |
| JWT-protected API dependencies | Scaffolded | `get_current_user` and `require_admin` exist. More route coverage is needed. |
| Agent chat enqueue/polling | Scaffolded | API, Celery task, Redis status/result keys, and frontend polling exist. Job ownership checks are still needed. |
| Agent tool catalog | Scaffolded | Tool schemas exist. Tool implementations are safe stubs until business logic and authorization are added. |
| Leave management | Scaffolded | Models and UI exist. API/service behavior needs to be implemented end to end. |
| Employee records | Scaffolded | Models and placeholder screens exist. Admin CRUD is planned. |
| Policies | Scaffolded | Models and UI exist. Search/RAG-style policy lookup is planned. |
| Payroll | Scaffolded | Models and UI exist. Read-only self-access is planned. |
| Notifications | Planned | Tool stub exists. Notification model/API/UI still need design and implementation. |
| Tests | Scaffolded | Test folders exist. Meaningful backend and frontend assertions are the next priority. |
| Docker Compose | Implemented | Local API, worker, frontend, Postgres, and Redis services are defined. |
| Kubernetes | Planned | `k8s/README.md` captures deployment intent; manifests will be added after the MVP workflow is stable. |

## Recommended MVP Slice

Build one polished workflow before expanding breadth:

1. Manager logs in.
2. Manager sees pending leave requests.
3. Manager asks the agent to approve Sarah Chen's leave.
4. Agent resolves employee, checks manager permission, updates leave status, and records a tool trace.
5. UI shows the final chat response and result card.
6. Tests prove that unauthorized users cannot approve or view another employee's data.

## Foundation Tasks

- Fix agent tool imports with explicit stubs.
- Make lint/type-check/test commands predictable.
- Add real tests for auth and leave permissions.
- Scope agent jobs to the authenticated user.
- Add service-level authorization before any AI tool writes data.
- Clean encoding artifacts in docs and comments.

## Frontend Direction

Stay with Vite React for the MVP. Use Vitest for component and hook tests, and add Playwright once the first end-to-end workflow stabilizes. Revisit Next.js only if Aria grows public pages, server-rendered content, or framework-level backend needs.
