# AI HR Workflow Agent — Product Requirements Document

**Version:** 1.0  
**Status:** Draft  
**Owner:** Duy Dang  
**Last Updated:** June 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Personas](#4-users--personas)
5. [Functional Requirements](#5-functional-requirements)
6. [User Stories](#6-user-stories)
7. [Use Cases](#7-use-cases)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Out of Scope](#9-out-of-scope)
10. [Assumptions & Constraints](#10-assumptions--constraints)
11. [Dependencies](#11-dependencies)
12. [Risks](#12-risks)
13. [Glossary](#13-glossary)

---

## 1. Product Overview

**AI HR Workflow Agent** is a web application that lets HR managers and employees interact with an AI agent to handle everyday HR tasks — approving leave requests, querying company policy, onboarding new hires, and reviewing payroll summaries — through a natural language chat interface backed by a structured HR data platform.

Instead of navigating multiple menus or waiting for a human HR representative, a user types a plain-English request and the agent reasons over real HR data, takes the appropriate action, and confirms the outcome.

### Core Value Proposition

| For | The problem | Our solution |
|-----|------------|--------------|
| HR Managers | Approving and tracking leave across teams requires jumping between tools | One chat interface to view, approve, and notify — in one message |
| Employees | Finding the right HR policy requires searching documentation manually | Ask in plain English, get a direct answer with the source policy |
| HR Administrators | Onboarding, payroll queries, and compliance checks are repetitive | Delegate routine tasks to the agent; focus on exception handling |

---

## 2. Problem Statement

HR workflows at mid-to-large organisations are fragmented. A manager approving a leave request today typically needs to:

1. Receive a notification in one system
2. Check team capacity in a calendar tool
3. Verify policy compliance in a document portal
4. Approve in an HR platform
5. Manually notify the employee

This creates friction, delays decisions, and increases the chance of policy violations. The problem compounds as teams grow.

**This product collapses these steps into a single natural language interaction**, with the AI agent handling the lookup, decision support, action, and notification in one flow.

---

## 3. Goals & Success Metrics

### Product Goals

- Reduce average time-to-decision on leave requests from days to minutes
- Give employees instant, accurate answers to policy questions without contacting HR
- Provide managers a single view of team HR status

### Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| Agent task completion rate | ≥ 85% of submitted requests resolved without human fallback |
| Average agent response time | ≤ 15 seconds end-to-end |
| Leave approval cycle time | < 5 minutes from request to decision |
| Policy query accuracy | ≥ 90% responses cite the correct policy section |
| User session length | ≥ 3 messages per session (indicates meaningful engagement) |

---

## 4. Users & Personas

### Persona 1 — HR Manager (Primary)

**Name:** Maria, People Operations Manager  
**Team size:** 15–40 direct reports or skip-levels  
**Pain points:** Repetitive approval tasks, inconsistent policy application, slow response loops  
**Goal:** Approve, reject, or delegate HR requests quickly without context-switching  
**Tech comfort:** Moderate — uses Slack and Excel daily, comfortable with web apps

### Persona 2 — Employee (Primary)

**Name:** James, Software Engineer  
**Pain points:** Doesn't know where to find policies, unsure how much leave he has, doesn't know who to ask  
**Goal:** Self-serve answers to HR questions and submit requests without emailing HR  
**Tech comfort:** High

### Persona 3 — HR Administrator (Secondary)

**Name:** Linda, HR Systems Administrator  
**Pain points:** Maintains policy documents, handles escalations when the system gives wrong answers, audits decisions  
**Goal:** Oversee system accuracy, manage policies and employee records, review agent activity  
**Tech comfort:** High — manages HR platforms day-to-day

---

## 5. Functional Requirements

### 5.1 Authentication & Access Control

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | Users must register with a company email and password | Must Have |
| AUTH-02 | Login returns a JWT access token valid for 8 hours | Must Have |
| AUTH-03 | Expired tokens can be refreshed without re-login | Must Have |
| AUTH-04 | Employees can only view their own leave and payroll records | Must Have |
| AUTH-05 | Managers can view leave records for their direct reports | Must Have |
| AUTH-06 | HR Admins can view and edit all records | Must Have |
| AUTH-07 | All API endpoints except /health and /auth/* require a valid JWT | Must Have |

### 5.2 AI Agent Chat

| ID | Requirement | Priority |
|----|-------------|----------|
| AGENT-01 | Users can submit a natural language request via the chat interface | Must Have |
| AGENT-02 | The system enqueues the request and returns a job ID immediately (no blocking) | Must Have |
| AGENT-03 | The UI polls for job status and displays results when ready | Must Have |
| AGENT-04 | The agent can call tools to read and write HR data in PostgreSQL | Must Have |
| AGENT-05 | The agent loop has a maximum of 10 iterations to prevent runaway calls | Must Have |
| AGENT-06 | The agent retains conversation history within a session | Must Have |
| AGENT-07 | Jobs that exceed 30 seconds return a graceful timeout message | Must Have |
| AGENT-08 | LLM API failures return a user-friendly error (not a stack trace) | Must Have |
| AGENT-09 | The agent identifies when a request is outside its capabilities and says so clearly | Should Have |
| AGENT-10 | Users can start a new session (clears history, keeps account) | Should Have |
| AGENT-11 | Tool call steps are optionally visible as a collapsible "Agent Thinking" trace | Nice to Have |

### 5.3 Leave Management

| ID | Requirement | Priority |
|----|-------------|----------|
| LEAVE-01 | Employees can view all their leave requests and statuses | Must Have |
| LEAVE-02 | Employees can submit a new leave request (type, dates, reason) | Must Have |
| LEAVE-03 | Managers can approve or reject leave requests | Must Have |
| LEAVE-04 | Managers can view all pending leave for their team | Must Have |
| LEAVE-05 | Leave status changes are logged with timestamp and who acted | Must Have |
| LEAVE-06 | Employees receive a notification when their leave status changes | Should Have |
| LEAVE-07 | Managers can see a team leave calendar view | Should Have |

### 5.4 HR Policy Access

| ID | Requirement | Priority |
|----|-------------|----------|
| POLICY-01 | All employees can browse and search HR policies | Must Have |
| POLICY-02 | Policies are categorised (leave, payroll, conduct, onboarding) | Must Have |
| POLICY-03 | The agent can retrieve and summarise policies in response to questions | Must Have |
| POLICY-04 | HR Admins can create, edit, and version policies | Should Have |
| POLICY-05 | Policy version history is retained and auditable | Nice to Have |

### 5.5 Employee Records

| ID | Requirement | Priority |
|----|-------------|----------|
| EMP-01 | HR Admins can create, update, and deactivate employee records | Must Have |
| EMP-02 | Employees can view their own profile | Must Have |
| EMP-03 | The agent can look up employee info by name or email to perform actions | Must Have |
| EMP-04 | Manager-subordinate relationships are stored and enforced for access control | Must Have |

### 5.6 Payroll

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-01 | Employees can view their payroll records by period | Must Have |
| PAY-02 | The agent can return a payroll summary for a given employee and period | Must Have |
| PAY-03 | Payroll records are read-only through the agent (no writes) | Must Have |
| PAY-04 | HR Admins can upload payroll data via the admin dashboard | Nice to Have |

### 5.7 Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| NOTIF-01 | The agent can trigger an in-app notification to an employee | Must Have |
| NOTIF-02 | Notifications appear in a notification bell in the UI header | Should Have |
| NOTIF-03 | Email notifications are sent for leave status changes | Nice to Have |

---

## 6. User Stories

### Authentication

- **As an employee**, I want to register with my work email so I can log in to the system.
- **As a user**, I want my session to stay active for 8 hours so I don't have to log in repeatedly during the workday.
- **As an HR Admin**, I want employees to only see their own records so that payroll and personal data stays private.

### AI Agent Chat

- **As a manager**, I want to type "Approve Sarah's leave request" and have the system handle it end-to-end so I don't have to navigate multiple screens.
- **As an employee**, I want to ask "How many days of annual leave do I have left?" and get an accurate answer in seconds.
- **As a manager**, I want the agent to tell me when it can't do something, so I know when to handle it manually.
- **As a user**, I want to see my conversation history when I return to the chat, so I don't lose context.
- **As a user**, I want a loading indicator while the agent is thinking, so I know my request is being processed.

### Leave Management

- **As an employee**, I want to submit a leave request with a date range and reason, and receive confirmation that it was submitted.
- **As a manager**, I want to see all pending leave requests from my team in one view, sorted by submission date.
- **As an employee**, I want to be notified when my leave request is approved or rejected, so I can plan accordingly.
- **As a manager**, I want to see which team members are on leave this week, so I can plan resourcing.

### Policy

- **As an employee**, I want to ask "What is the parental leave policy?" and get a clear, cited answer without searching through documents.
- **As an HR Admin**, I want to update a policy and have the new version immediately available to the agent, so employees always get current information.

### Payroll

- **As an employee**, I want to ask "What was my net salary in March?" and see the exact figure from our payroll records.
- **As an HR Admin**, I want payroll data to be read-only through the agent, so no accidental edits can occur.

---

## 7. Use Cases

### UC-01: Manager Approves a Leave Request via Chat

**Actor:** HR Manager  
**Preconditions:** Manager is logged in. A leave request with status `pending` exists for an employee in their team.  
**Trigger:** Manager types "Approve Sarah Chen's leave request and notify her."

**Main Flow:**
1. Manager submits message in chat UI.
2. System enqueues an agent job and returns a job ID. UI shows a "Processing..." indicator.
3. Celery worker picks up the job and starts the agent loop.
4. Agent calls `get_employee_info(name="Sarah Chen")` → receives employee ID and confirms she reports to this manager.
5. Agent calls `get_leave_request(employee_id=...)` → retrieves the pending leave request (5 days annual leave, next week).
6. Agent calls `update_leave_status(request_id=..., status="approved", approved_by=manager_id)` → leave record updated in PostgreSQL.
7. Agent calls `send_notification(employee_id=..., message="Your leave request has been approved.")` → notification created.
8. Agent returns final text: "Done. Sarah Chen's leave request for 5 days (June 20–26) has been approved and she has been notified."
9. UI polls, detects job complete, displays agent response.

**Alternate Flow — No Pending Request Found:**  
At step 5, if no pending leave request exists, the agent responds: "I couldn't find a pending leave request for Sarah Chen. She may not have submitted one, or it may have already been actioned."

**Postconditions:** Leave record status is `approved` in the database. Notification exists for the employee.

---

### UC-02: Employee Queries HR Policy

**Actor:** Employee  
**Preconditions:** Employee is logged in. An HR policy for parental leave exists in the database.  
**Trigger:** Employee types "What's the parental leave policy?"

**Main Flow:**
1. Employee submits message.
2. Agent job is enqueued; UI shows loading state.
3. Agent calls `get_policy(category="parental")` → retrieves full policy content and version.
4. Agent summarises the policy in plain English and includes key details (entitlement length, eligibility, how to apply).
5. Agent returns response with a note: "This is based on policy version v2.1, effective March 2025."
6. UI displays the response.

**Alternate Flow — Policy Not Found:**  
Agent responds: "I don't have a parental leave policy on file. Please contact HR directly at hr@company.com."

---

### UC-03: Employee Submits a Leave Request via Chat

**Actor:** Employee  
**Preconditions:** Employee is logged in.  
**Trigger:** Employee types "I'd like to book annual leave from July 14 to July 18."

**Main Flow:**
1. Employee submits message.
2. Agent calls `get_employee_info` to confirm employee identity and get their ID.
3. Agent calls `submit_leave_request(employee_id=..., type="annual", start_date="2026-07-14", end_date="2026-07-18", days=5)` → new leave record created with status `pending`.
4. Agent responds: "Your annual leave request for July 14–18 (5 days) has been submitted and is pending approval from your manager."
5. A notification is sent to the employee's manager.

**Postconditions:** Leave request exists in the database with status `pending`. Manager is notified.

---

### UC-04: Manager Reviews Team Leave Overview

**Actor:** HR Manager  
**Preconditions:** Manager is logged in. Team members have leave requests.  
**Trigger:** Manager navigates to the Team Overview page, or types "Show me all pending leave for my team."

**Main Flow:**
1. Manager visits `/team` page (or submits chat message).
2. System (or agent) calls `list_team_leave(manager_id=...)` → returns all leave requests for direct reports.
3. UI displays a table: employee name, leave type, dates, days, status.
4. Manager can click to view details or trigger approval actions.

---

### UC-05: Employee Views Payroll Summary

**Actor:** Employee  
**Preconditions:** Employee is logged in. Payroll records exist for the current year.  
**Trigger:** Employee types "What was my net salary for Q1 2026?"

**Main Flow:**
1. Employee submits message.
2. Agent calls `get_employee_info` to resolve identity.
3. Agent calls `get_payroll_summary(employee_id=..., period="Q1 2026")` → retrieves January, February, March records.
4. Agent responds with a summary table: month, gross, net, currency.

---

### UC-06: HR Admin Updates an Employee Record

**Actor:** HR Administrator  
**Preconditions:** Admin is logged in with `is_admin = true`. Employee record exists.  
**Trigger:** Admin navigates to the employee list and edits a record.

**Main Flow:**
1. Admin visits `/employees` (admin-only route).
2. Admin selects an employee and updates their department or role.
3. System sends `PATCH /api/employees/{id}` with the updated fields.
4. FastAPI validates the payload, checks `is_admin`, and writes to PostgreSQL.
5. Success toast shown: "Employee record updated."

---

### UC-07: Agent Job Fails Gracefully

**Actor:** Any logged-in user  
**Preconditions:** LLM API is temporarily unavailable.  
**Trigger:** User submits any chat message.

**Main Flow:**
1. Celery worker picks up the job and calls the LLM API.
2. LLM API returns a 503 error.
3. Worker catches the exception, writes `{ status: "failed", message: "The AI service is temporarily unavailable. Please try again in a moment." }` to Redis.
4. React UI polls, detects failed status, displays the error message in the chat without showing a stack trace.

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Requirement | Target |
|-------------|--------|
| API response time (non-agent endpoints) | p95 < 200ms |
| Agent job enqueue time (POST /agent/chat) | < 500ms |
| Agent end-to-end completion time | < 15 seconds for typical 3-tool tasks |
| UI first contentful paint | < 2 seconds on a standard connection |
| Polling interval | Every 2 seconds while job is pending |

### 8.2 Reliability

- Agent job queue (Redis) must recover gracefully from worker restart; jobs must not be lost
- Database migrations must be zero-downtime (Alembic with non-breaking schema changes)
- All services must have a `/health` liveness endpoint consumed by Kubernetes probes
- CI pipeline must block deployments if tests fall below 70% coverage

### 8.3 Security

- Passwords stored as bcrypt hashes; plaintext never logged or stored
- JWT tokens must not be stored in `localStorage` (use in-memory state or `httpOnly` cookies)
- All database queries use parameterised statements (SQLAlchemy ORM) — no raw string interpolation
- Rate limiting on `/api/agent/chat`: 10 requests per minute per user
- Secrets (DB password, JWT secret, LLM API key) stored in Kubernetes Secrets or AWS Secrets Manager — never in source code

### 8.4 Scalability

- FastAPI and Celery worker pods are horizontally scalable (stateless design)
- Agent memory stored in PostgreSQL, not in-process — so any worker can pick up any job
- Redis used as message broker and result cache — not as primary data store

### 8.5 Observability

- All API requests logged in structured JSON: `method`, `path`, `status_code`, `duration_ms`, `user_id`
- All Celery tasks logged: `task_id`, `job_id`, `status`, `tool_calls_made`, `duration_ms`
- Every agent tool call logged: `tool_name`, `input_args`, `result_summary`, `duration_ms`
- `/api/metrics` endpoint exposes: active job count, queue depth, error rate (last 5 minutes)

### 8.6 Accessibility

- All interactive elements keyboard-navigable
- ARIA labels on icon-only buttons
- Colour contrast meets WCAG AA (4.5:1 for body text)
- Chat UI announces new agent responses to screen readers via ARIA live regions

---

## 9. Out of Scope

The following are explicitly excluded from v1.0:

- **Mobile native app** — web responsive only
- **Multi-language support** — English only
- **Integration with external HR systems** (Workday, BambooHR, ADP) — this is a standalone platform
- **Document upload** — employees cannot attach files to leave requests
- **Video or voice interface** — text chat only
- **Real-time websocket push** — polling is sufficient for v1; websockets are a v2 upgrade
- **Custom LLM fine-tuning** — uses off-the-shelf Anthropic or OpenAI models with tool-calling
- **Multi-tenancy** — single company/organisation in v1

---

## 10. Assumptions & Constraints

### Assumptions

- All employees have a company email address and can self-register
- The manager-subordinate hierarchy is flat enough that one FK (`manager_id`) is sufficient
- Payroll data will be seeded manually for the portfolio demo; no real payroll integration is needed
- The LLM provider (Anthropic or OpenAI) has sufficient uptime for a portfolio project; no fallback model is required in v1
- A single Redis instance is sufficient for the portfolio scope (no Redis Sentinel or Cluster)

### Constraints

- **Budget:** Free-tier or low-cost cloud only (Railway, AWS Free Tier, or personal AWS account)
- **Timeline:** 6 weeks, 3 milestones
- **Team size:** Solo developer
- **LLM costs:** Agent tool-calling loops must be kept under 10 LLM calls per user request to manage API costs
- **Data:** No real employee or payroll data — all seed data is fictional

---

## 11. Dependencies

| Dependency | Type | Risk if unavailable |
|------------|------|---------------------|
| Anthropic API (claude-sonnet-4-6) | External SaaS | Agent feature unavailable; fallback to OpenAI |
| PostgreSQL 15 | Infrastructure | Core data storage — critical |
| Redis 7 | Infrastructure | Queue and cache unavailable — agent chat blocked |
| GitHub Actions | CI/CD | Manual deploy workaround possible |
| Railway / AWS ECS | Hosting | Switch to alternative cloud provider |
| React, FastAPI, SQLAlchemy, Celery | Open source libraries | All stable, well-maintained; low risk |

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM API returns unexpected tool call format | Medium | High | Strict output validation; fallback to error message |
| Agent loop runs > 10 iterations on edge-case prompts | Low | Medium | Hard cap at 10 iterations; log and alert if cap hit |
| Celery worker crashes mid-job | Low | Medium | Celery's `acks_late=True` ensures jobs are requeued on worker restart |
| PostgreSQL migration breaks production data | Low | High | Test migrations on a copy of seed data in CI before deploy |
| Polling creates too many HTTP requests under load | Medium | Low | 2-second interval is acceptable for portfolio; v2 would use WebSockets |
| LLM hallucinates policy content not in the database | Medium | High | Agent instructed to cite only data returned by tools; "I don't know" response when tool returns empty |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Agent** | An LLM-powered reasoning loop that decides which tools to call in order to complete a user's request |
| **Tool** | A Python function the agent can invoke, mapped to a database operation (e.g. `get_leave_request`, `update_leave_status`) |
| **Tool call** | A structured request from the LLM to execute a specific tool with given arguments |
| **Job** | A unit of async work enqueued in Celery/Redis representing one agent conversation turn |
| **Job ID** | A unique identifier returned immediately when a chat message is submitted; used to poll for results |
| **Session** | A contiguous conversation between a user and the agent; identified by `session_id` |
| **Agent memory** | Conversation history (user messages, assistant responses, tool results) stored in PostgreSQL per session |
| **Celery worker** | A background Python process that consumes jobs from the Redis queue and runs the agent loop |
| **JWT** | JSON Web Token — a signed token used to authenticate API requests without server-side session state |
| **Alembic** | Python database migration tool used with SQLAlchemy to apply schema changes safely |
| **LLM** | Large Language Model — the AI model (e.g. Claude Sonnet, GPT-4o) that powers the agent's reasoning |
| **Polling** | The React UI's technique of repeatedly calling `GET /agent/status/{job_id}` every 2 seconds until the job is complete |

---

*This document is a living artifact. It should be updated as scope changes are agreed and milestones are completed.*
