# Aria Implementation Roadmap

This roadmap keeps the project honest: what ships today, what is partial, and what is intentionally later.

## Status Legend

| Status | Meaning |
| --- | --- |
| Implemented | Works in the app today and should be kept passing. |
| Scaffolded | File structure or UI exists, but behavior is incomplete. |
| Planned | Direction chosen; implementation has not started. |
| Deferred | Explicitly out of the current MVP / portfolio scope. |

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| React app shell | Implemented | Vite, React Router, pages, layout, shared UI. |
| Design tokens | Implemented | Aligned with `docs/hr-agent-design-system.html`. |
| Auth (JWT login) | Implemented | Login + JWT dependencies; refresh tokens deferred. |
| Agent chat enqueue/polling | Implemented | Celery + Redis job status/result; job ownership checks in place. |
| Agent tools + authorization | Implemented | Leave, team, policy, payroll, notifications — service-level auth on writes. |
| Leave management | Implemented | Submit / approve / reject via API, UI, and agent tools. |
| Employee records | Implemented | Admin CRUD and manager team views. |
| Policies | Implemented | Keyword/category lookup for agent answers (not RAG). |
| Payroll | Implemented | Read-only self / manager / admin scoped access. |
| Notifications | Implemented | In-app bell; auto-notify on leave submit/approve/reject. |
| Tests + CI | Implemented | Backend pytest/ruff/mypy; frontend lint/type-check/Vitest; GitHub Actions. |
| Docker Compose | Implemented | API, worker, frontend, Postgres, Redis. Local TLS/`SSL_VERIFY` and frontend entrypoint workarounds for Windows/WSL + corporate TLS. |
| Demo media (GIF/PNG) | Planned | README links to `DEMO.md` until captures are added. |
| Playwright E2E | Planned | Manual path documented in `DEMO.md`. |
| Kubernetes | Planned | Intent in `k8s/README.md`; manifests later. |
| Hosted demo deploy | Planned | Not configured yet. |
| RAG policy search | Deferred | Current lookup is sufficient for MVP. |
| Refresh tokens | Deferred | Access-token JWT is enough for local demo. |

## MVP slice (done)

The core portfolio demo path works end to end:

1. Employee books leave via agent (or Leave UI).
2. Manager sees pending requests.
3. Manager asks the agent to approve and notify.
4. Tool trace + in-app notification confirm the outcome.
5. Tests cover unauthorized leave access and main UI flows.

Follow [DEMO.md](DEMO.md) for the scripted walkthrough.

## Next (when useful)

- Add a short demo GIF to the README.
- Playwright smoke for the leave approval path.
- Small hosted demo environment for reviewers.
- Kubernetes manifests after local MVP stays stable.

## Frontend direction

Stay on Vite + React for the portfolio MVP. Vitest covers components/hooks; add Playwright when the demo path needs automated UI coverage. Revisit Next.js only if Aria needs public SSR pages or framework-level backend features.
