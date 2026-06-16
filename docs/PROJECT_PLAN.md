# Aria Project Plan

**Product:** Aria - AI HR Workflow Agent  
**Owner:** Duy Dang  
**Mode:** Solo builder with AI-assisted development  
**Planning Style:** Lightweight epics, user stories, and acceptance criteria  
**Last Updated:** June 2026

## Purpose

This plan turns the product requirements into an execution backlog. The goal is to build a credible applied-AI HR workflow app one vertical slice at a time, while keeping scope clear enough for a solo developer.

The plan is intentionally practical:

- Epics define major product areas.
- User stories define user value.
- Acceptance criteria define what "done" means.
- Dependencies call out sequencing risks.
- Status keeps the project honest.

## Status Legend

| Status | Meaning |
| --- | --- |
| Not Started | No meaningful implementation yet. |
| Scaffolded | Structure or UI exists, but behavior is incomplete. |
| In Progress | Actively being implemented. |
| Implemented | Works locally and passes available checks. |
| Verified | Has automated tests or a documented manual verification path. |
| Deferred | Explicitly outside the current MVP. |

## Priority Legend

| Priority | Meaning |
| --- | --- |
| P0 | Required for the MVP demo path. |
| P1 | Important for a credible portfolio product. |
| P2 | Useful polish or broader product coverage. |
| P3 | Future enhancement. |

## MVP Demo Narrative

The first complete demo should prove the most important claim: Aria can safely complete an HR workflow through an AI assistant.

1. Manager logs in.
2. Manager sees pending team leave requests.
3. Manager asks Aria to approve Sarah Chen's leave request.
4. Aria resolves Sarah, checks that the manager is authorized, updates the leave request, records the action, and returns a result card.
5. Employee-facing leave status is now approved.
6. Unauthorized users cannot view or approve the same request.

## Epic Summary

| Epic | Name | Priority | Status | Goal |
| --- | --- | --- | --- | --- |
| E0 | Project Foundation | P0 | In Progress | Make the project reliable to run, inspect, and extend. |
| E1 | Authentication & Roles | P0 | Scaffolded | Users can log in and API permissions are enforceable. |
| E2 | Employee & Team Data | P0 | Scaffolded | The system understands employee identity and manager relationships. |
| E3 | Leave Workflow | P0 | Scaffolded | Employees and managers can complete leave flows. |
| E4 | AI Agent Core | P0 | Scaffolded | Chat requests run asynchronously and return traceable responses. |
| E5 | Safe Agent Tools | P0 | Scaffolded | Agent tools enforce backend authorization before reading or writing HR data. |
| E6 | Policies | P1 | Scaffolded | Users can browse policies and the agent can answer policy questions from stored data. |
| E7 | Payroll | P1 | Scaffolded | Employees can view own payroll summaries; agent access is read-only. |
| E8 | Notifications | P1 | Planned | Users receive in-app status updates for important HR events. |
| E9 | Testing & Quality | P0 | Scaffolded | Important workflows are protected by automated tests. |
| E10 | Portfolio Polish | P1 | In Progress | The project tells a strong story through docs, mockups, and demo flow. |
| E11 | Deployment & Operations | P2 | Planned | The app has a credible local and deployment story. |

---

## E0 - Project Foundation

**Goal:** Make the repository predictable enough that new features can be added safely.

Detailed first-task guide: [E0-S5 Backend Test Environment](development/E0-S5-backend-test-environment.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E0-S1 | As a developer, I can run frontend type-check and build commands so I know the React app is healthy. | P0 | Implemented |
| E0-S2 | As a developer, I can run lint with a known config so style and common bugs are caught early. | P0 | Scaffolded |
| E0-S3 | As a developer, I can see what is implemented versus planned so I do not overstate progress. | P0 | Implemented |
| E0-S4 | As a developer, I can rely on design tokens matching the interactive mockup so UI work stays consistent. | P1 | Implemented |
| E0-S5 | As a developer, I can run backend tests locally without depending on secret production-like environment variables. | P0 | Verified |

### Acceptance Criteria

- `frontend` type-check passes.
- `frontend` production build passes.
- ESLint has a flat config compatible with ESLint 9.
- New lint dependencies are installed and lockfile is updated.
- `ROADMAP.md` and this project plan show current status honestly.
- Backend test setup can run with test-specific settings and no real LLM key.

### Dependencies

- Frontend dependency installation for ESLint plugins.
- Backend test environment settings.

---

## E1 - Authentication & Roles

**Goal:** Users can authenticate, and backend code can make role-based decisions.

Detailed guides:

- [E1-S3 Duplicate Email Registration](development/E1-S3-duplicate-email-registration.md)
- [E1-S4 Inactive User Protected Routes](development/E1-S4-inactive-user-protected-routes.md)
- [E1-S5 Admin Only Routes](development/E1-S5-admin-only-routes.md)
- [E1-S7 Refresh Token Decision](development/E1-S7-refresh-token-decision.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E1-S1 | As a user, I can register with email and password so I can access Aria. | P1 | Scaffolded |
| E1-S2 | As a user, I can log in and receive an access token so protected API calls work. | P0 | Scaffolded |
| E1-S3 | As a user, I cannot register the same email twice. | P0 | Verified |
| E1-S4 | As an inactive user, I cannot access protected API routes. | P0 | Verified |
| E1-S5 | As an admin, I can access admin-only routes. | P1 | Verified |
| E1-S6 | As a non-admin user, I am blocked from admin-only routes. | P1 | Verified |
| E1-S7 | As a product owner, I can decide whether refresh tokens are in MVP or deferred. | P1 | Verified |

### Acceptance Criteria

- Login returns a valid JWT with `sub`, expiry, and admin claim.
- Protected routes reject missing, invalid, and expired tokens.
- Duplicate registration returns a clear 409-style error.
- Passwords are hashed and plaintext passwords are never returned.
- Tests cover successful login, failed login, duplicate registration, inactive user, and admin guard.

### Dependencies

- User model.
- Auth service.
- Test database setup.

---

## E2 - Employee & Team Data

**Goal:** Aria understands who a user is as an employee and what team relationships permit.

Detailed guide:

- [E2-S1 User Employee Link](development/E2-S1-user-employee-link.md)
- [E2-S2 Direct Reports](development/E2-S2-direct-reports.md)
- [E2-S3 Manager Relationship Check](development/E2-S3-manager-relationship-check.md)
- [E2-S5 My Profile](development/E2-S5-my-profile.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E2-S1 | As an employee, my user account can be linked to an employee record. | P0 | Verified |
| E2-S2 | As a manager, I can see my direct reports. | P0 | Verified |
| E2-S3 | As the backend, I can answer whether one employee reports to another. | P0 | Verified |
| E2-S4 | As an admin, I can create and update employee records. | P2 | Not Started |
| E2-S5 | As a user, I can view my own profile information. | P1 | Verified |

### Acceptance Criteria

- Seed data includes at least one admin, one manager, and multiple employees.
- Manager relationships are represented with `manager_id`.
- Service functions expose `get_employee_for_user`, `list_direct_reports`, and `can_manage_employee`.
- Tests prove manager relationship checks work for allowed and denied cases.

### Dependencies

- Auth user model.
- Employee model.
- Seed data.

---

## E3 - Leave Workflow

**Goal:** Build the first end-to-end HR workflow.

Detailed guide:

- [E3-S1 My Leave Requests](development/E3-S1-my-leave-requests.md)
- [E3-S2 Submit Leave Request](development/E3-S2-submit-leave-request.md)
- [E3-S3 Pending Team Leave Requests](development/E3-S3-pending-team-leave-requests.md)
- [E3-S4 Approve Direct Report Leave](development/E3-S4-approve-direct-report-leave.md)
- [E3-S5 Reject Direct Report Leave](development/E3-S5-reject-direct-report-leave.md)
- [E3-S6 Leave Request Access Control](development/E3-S6-leave-request-access-control.md)
- [E3-S8 Leave Page UI](development/E3-S8-leave-page-ui.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E3-S1 | As an employee, I can view my own leave requests and statuses. | P0 | Verified |
| E3-S2 | As an employee, I can submit a leave request with type, date range, and reason. | P0 | Verified |
| E3-S3 | As a manager, I can view pending leave requests for my direct reports. | P0 | Verified |
| E3-S4 | As a manager, I can approve a direct report's leave request. | P0 | Verified |
| E3-S5 | As a manager, I can reject a direct report's leave request with a reason. | P1 | Verified |
| E3-S6 | As an employee, I cannot view or modify another employee's leave request. | P0 | Verified |
| E3-S7 | As the system, every leave status change records who acted and when. | P0 | Scaffolded |
| E3-S8 | As a user, I can review leave requests from the Leave page UI. | P1 | Verified |

### Acceptance Criteria

- Leave routes are protected by JWT.
- Employees can only access their own leave requests.
- Managers can access direct-report leave requests.
- Unauthorized approval attempts return 403.
- Approval updates `status`, `approved_by`, and `approved_at`.
- Tests cover employee self-access, manager approval, non-manager denial, and admin path if supported.

### Dependencies

- E1 Authentication & Roles.
- E2 Employee & Team Data.

---

## E4 - AI Agent Core

**Goal:** Chat requests run through an async agent flow and return useful results.

Detailed guide:

- [E4-S1 Chat Enqueue Job ID](development/E4-S1-chat-enqueue-job-id.md)
- [E4-S2 Agent Job Status Polling](development/E4-S2-agent-job-status-polling.md)
- [E4-S3 Agent Job Result Fetch](development/E4-S3-agent-job-result-fetch.md)
- [E4-S4 Conversation Session Memory](development/E4-S4-conversation-session-memory.md)
- [E4-S5 Friendly Agent Job Failures](development/E4-S5-friendly-agent-job-failures.md)
- [E4-S6 Agent Tool Trace Steps](development/E4-S6-agent-tool-trace-steps.md)
- [E4-S7 Agent Job Ownership](development/E4-S7-agent-job-ownership.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E4-S1 | As a user, I can submit a chat message and immediately receive a job ID. | P0 | Verified |
| E4-S2 | As a user, I can poll job status until the response is ready. | P0 | Verified |
| E4-S3 | As a user, I can fetch the completed job result. | P0 | Verified |
| E4-S4 | As a user, I can maintain a conversation session. | P1 | Verified |
| E4-S5 | As a user, failed jobs show a friendly message instead of a stack trace. | P0 | Verified |
| E4-S6 | As a user, I can see tool trace steps for agent actions. | P1 | Verified |
| E4-S7 | As the backend, agent jobs are scoped to the user who created them. | P0 | Verified |

### Acceptance Criteria

- `POST /api/agent/chat` returns quickly without waiting on the LLM.
- `GET /api/agent/status/{job_id}` and `GET /api/agent/result/{job_id}` reject users who do not own the job.
- Agent memory is stored by `session_id` and `user_id`.
- Worker errors set job status to `failed` and a safe result message.
- Frontend polling clears intervals on completion, failure, or unmount.

### Dependencies

- Redis.
- Celery worker.
- Auth.
- Job ownership storage design.

---

## E5 - Safe Agent Tools

**Goal:** The model can request tool calls, but only backend code can authorize and execute them.

Detailed guide:

- [E5-S1 Trusted Tool Context](development/E5-S1-trusted-tool-context.md)
- [E5-S2 Employee Agent Read Tools](development/E5-S2-employee-agent-read-tools.md)
- [E5-S3 Manager Agent Leave Tools](development/E5-S3-manager-agent-leave-tools.md)
- [E5-S4 Payroll Agent Access Control](development/E5-S4-payroll-agent-access-control.md)
- [E5-S6 Agent Tool Error Contract](development/E5-S6-agent-tool-error-contract.md)
- [E5-S7 Agent Tool Call Logging](development/E5-S7-agent-tool-call-logging.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E5-S1 | As the backend, every tool receives a trusted tool context containing user and employee identity. | P0 | Verified |
| E5-S2 | As an employee, agent tools can read my own profile and leave data. | P0 | Verified |
| E5-S3 | As a manager, agent tools can read and update direct-report leave requests. | P0 | Verified |
| E5-S4 | As an employee, agent tools cannot read another employee's payroll. | P0 | Verified |
| E5-S5 | As an admin, agent tools can perform broader HR actions where explicitly allowed. | P1 | Not Started |
| E5-S6 | As a user, unsupported tool requests return a clear not-implemented or not-authorized response. | P0 | Verified |
| E5-S7 | As an operator, every tool call is logged with tool name, user, and result summary. | P1 | Verified |

### Acceptance Criteria

- Tool functions do not trust model-supplied `employee_id` alone.
- Tool functions verify the current user can access the requested record.
- Tool output is structured and safe to show back to the model.
- Tests cover both allowed and denied tool calls.
- The first write-capable tool is `update_leave_status`, protected by manager/admin checks.

### Dependencies

- E1 Authentication & Roles.
- E2 Employee & Team Data.
- E3 Leave Workflow service functions.

---

## E6 - Policies

**Goal:** Users can browse HR policies, and the agent can answer policy questions from stored policy data.

Detailed guide:

- [E6-S1 Policy Categories](development/E6-S1-policy-categories.md)
- [E6-S2 Policy Search](development/E6-S2-policy-search.md)

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E6-S1 | As a user, I can browse policy categories. | P1 | Verified |
| E6-S2 | As a user, I can search policy titles and categories. | P1 | Verified |
| E6-S3 | As a user, I can ask the agent about a policy and receive a grounded answer. | P1 | Not Started |
| E6-S4 | As a user, policy answers identify the source policy and version. | P1 | Not Started |
| E6-S5 | As an admin, I can create and update policy content. | P2 | Not Started |

### Acceptance Criteria

- Policy records include title, category, body, version, and effective date.
- Agent policy tool returns only stored policy content.
- If no policy exists, the assistant says it does not know.
- Tests cover found and not-found policy lookups.

### Dependencies

- Policy model.
- Seed policy data.
- Agent tool context.

---

## E7 - Payroll

**Goal:** Payroll data is useful in the demo while staying strictly read-only and permission-scoped.

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E7-S1 | As an employee, I can view my own payroll records by period. | P1 | Scaffolded |
| E7-S2 | As an employee, I cannot view another employee's payroll records. | P0 | Not Started |
| E7-S3 | As an admin, I can view payroll summaries for employees. | P2 | Not Started |
| E7-S4 | As a user, I can ask the agent for my own payroll summary. | P1 | Not Started |
| E7-S5 | As the system, the agent cannot write payroll data. | P0 | Not Started |

### Acceptance Criteria

- Payroll routes are read-only for MVP.
- Employee access is self-only unless admin rules allow otherwise.
- Agent payroll tool enforces self/admin access.
- Tests prove cross-user payroll access is denied.

### Dependencies

- Auth.
- Employee-user linkage.
- Payroll seed data.

---

## E8 - Notifications

**Goal:** Users receive clear updates when HR workflow status changes.

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E8-S1 | As an employee, I receive an in-app notification when my leave request is approved or rejected. | P1 | Not Started |
| E8-S2 | As a manager, I receive an in-app notification when a direct report submits leave. | P1 | Not Started |
| E8-S3 | As a user, I can see unread notification count in the app header. | P2 | Not Started |
| E8-S4 | As a user, I can mark notifications as read. | P2 | Not Started |
| E8-S5 | As the agent, I can trigger a notification through a safe backend tool. | P1 | Scaffolded |

### Acceptance Criteria

- Notifications are stored in the database.
- Notifications are scoped to the recipient user or employee.
- Leave approval creates a notification.
- Agent notification tool cannot message arbitrary users without authorization.

### Dependencies

- Leave Workflow.
- Employee-user linkage.

---

## E9 - Testing & Quality

**Goal:** Tests protect the highest-risk areas: auth, permissions, agent tools, and leave workflow.

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E9-S1 | As a developer, I can run backend tests locally. | P0 | Not Started |
| E9-S2 | As a developer, I can run frontend unit tests locally. | P1 | Scaffolded |
| E9-S3 | As a developer, auth behavior is covered by API/service tests. | P0 | Not Started |
| E9-S4 | As a developer, leave permissions are covered by service/API tests. | P0 | Not Started |
| E9-S5 | As a developer, agent tools are tested with mocked model/tool calls. | P0 | Not Started |
| E9-S6 | As a developer, the first MVP flow has an end-to-end test or documented manual QA script. | P1 | Not Started |

### Acceptance Criteria

- Tests do not call real LLM APIs.
- Test database is isolated and resettable.
- Permission-denied cases are tested, not just happy paths.
- CI can eventually run type-check, lint, tests, and build.

### Dependencies

- Test settings refactor.
- Meaningful service functions.
- Frontend dependency install.

---

## E10 - Portfolio Polish

**Goal:** Make the project easy to understand, demo, and discuss in interviews.

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E10-S1 | As a reviewer, I can read a README and understand the product, stack, and setup. | P0 | Implemented |
| E10-S2 | As a reviewer, I can see an architecture document with tradeoffs and failure modes. | P1 | Implemented |
| E10-S3 | As a reviewer, I can see a PRD that explains users, requirements, and scope. | P1 | Implemented |
| E10-S4 | As a reviewer, I can open an interactive mockup that shows the intended UI. | P1 | Implemented |
| E10-S5 | As a reviewer, I can follow a scripted demo path from login to completed leave approval. | P0 | Not Started |
| E10-S6 | As a reviewer, I can see screenshots or GIFs of the MVP flow. | P2 | Not Started |
| E10-S7 | As a reviewer, I can clearly tell planned features from built features. | P0 | Implemented |

### Acceptance Criteria

- README links to PRD, architecture, project plan, roadmap, and mockup.
- Demo script uses seeded users and seeded data.
- Screenshots are current and generated from the working app.
- Docs avoid claiming planned features are already implemented.

### Dependencies

- MVP flow implementation.
- Screenshot tooling or manual capture.

---

## E11 - Deployment & Operations

**Goal:** Provide a credible deployment story without over-investing before the MVP is useful.

### Stories

| Story ID | User Story | Priority | Status |
| --- | --- | --- | --- |
| E11-S1 | As a developer, I can run the full stack locally with Docker Compose. | P0 | Implemented |
| E11-S2 | As a developer, API and worker containers share the same backend code and settings. | P1 | Implemented |
| E11-S3 | As an operator, health checks report database and Redis connectivity. | P1 | Scaffolded |
| E11-S4 | As an operator, secrets are not committed to source control. | P0 | Scaffolded |
| E11-S5 | As a reviewer, Kubernetes planning notes show deployment thinking. | P2 | Planned |
| E11-S6 | As a product owner, I can deploy a small demo environment for portfolio review. | P2 | Not Started |

### Acceptance Criteria

- Docker Compose starts API, worker, frontend, Postgres, and Redis.
- `.env.example` is safe and accurate.
- Real `.env` remains gitignored.
- Production deployment is documented as planned unless verified.
- Kubernetes manifests are not added until the local MVP workflow is stable.

### Dependencies

- Stable app startup.
- Seed data.
- Cloud provider decision.

---

## Suggested Build Sequence

### Phase 1 - Foundation

1. Install frontend lint dependencies and update lockfile.
2. Make backend tests run with test settings.
3. Add real auth tests.
4. Clean docs encoding in PRD and architecture.

### Phase 2 - Data And Permissions

1. Improve seed data with employees, manager relationships, leave requests, policies, and payroll.
2. Add employee service helpers.
3. Add leave service with permission checks.
4. Add API tests for allowed and denied leave access.

### Phase 3 - First Workflow

1. Implement leave list and approval endpoints.
2. Wire Leave page to real data.
3. Implement safe agent tools for employee lookup, leave lookup, and leave approval.
4. Scope agent jobs to owners.
5. Show tool trace and result card in chat.

### Phase 4 - Portfolio Demo

1. Add demo script.
2. Add screenshots.
3. Add Playwright or manual QA script for the MVP flow.
4. Update README with current implemented status.

## Definition Of Done

A story is done when:

- The behavior is implemented in the correct layer.
- Access control is enforced server-side where applicable.
- Error handling is user-safe.
- At least one verification path exists.
- Documentation or roadmap status is updated.
- The frontend type-check and build still pass.

## Product Management Notes

- Prefer one complete workflow over many shallow pages.
- The first write-capable AI workflow must be permission-safe.
- Do not let the LLM become the authorization layer.
- Keep the UI operational and focused; this is an internal work tool, not a marketing site.
- Every planned feature should either support the MVP demo or be explicitly deferred.
