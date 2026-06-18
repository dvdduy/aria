# Aria — Demo Script

This script walks through the core workflows using seeded data. It takes approximately 10 minutes end-to-end.

**Prerequisites:** Stack running via `docker compose up --build` at `http://localhost:5173`.

---

## Seeded Accounts

| Email | Password | Role |
|---|---|---|
| `employee@aria.dev` | `employee123` | Sam Staff — Software Engineer |
| `manager@aria.dev` | `manager123` | Morgan Manager — Engineering Manager |
| `admin@aria.dev` | `admin123` | Alex Admin — HR Administrator |

Morgan's team: Sam Staff, Sarah Chen, James Kim, Maria Lopez, Alex Tran, Rohan Patel.

---

## Scenario 1 — Employee Self-Service via Agent

**Log in as `employee@aria.dev` / `employee123`**

### 1a. Check leave balance

Navigate to **Chat**. Type:

> How many days of annual leave do I have left?

Expected: Agent calls `get_leave_balance`, returns something like:
> You have **18 days** of annual leave remaining (2 days used from 20 days entitlement).

Expand **Agent thinking** (chevron below the response) to see the tool call trace.

### 1b. Ask a policy question

> What is the parental leave policy?

Expected: Agent calls `get_policy`, returns a summary of the Parental Leave Policy (v2.1, effective March 2025): 16 weeks fully paid for primary caregivers, 4 weeks for secondary.

### 1c. Submit a leave request

> I'd like to book annual leave from August 11 to August 15.

Expected: Agent calls `submit_leave_request`, creates a pending request, and responds with confirmation. Navigate to **Leave** to verify the new request appears with status `Pending`.

> **What to notice:** Morgan (the manager) receives a notification in their bell within 30 seconds of this submission.

---

## Scenario 2 — Manager Approves Leave via Agent (MVP Flow)

**Log in as `manager@aria.dev` / `manager123`**

### 2a. Review the Dashboard

The Dashboard shows:
- **Pending approvals** stat card with the count of team requests
- **Pending requests** section listing Sam, Sarah Chen, James Kim, and Maria Lopez

### 2b. Check team leave via agent

Navigate to **Chat**. Type:

> Who on my team has pending leave requests?

Expected: Agent calls `list_team_leave` with `status_filter: pending`, returns a list of pending requests across the team.

### 2c. Approve Sam Staff's leave and notify them

> Approve Sam Staff's leave request and send them a notification letting them know.

Expected agent flow (visible in tool trace):
1. `get_employee_info` or `get_team_member` → resolves Sam Staff
2. `get_leave_request` → finds the pending Jul 14–18 request
3. `update_leave_status` → sets status to `approved`
4. `send_notification` → sends in-app message to Sam

Final response: *"Done. Sam Staff's annual leave for July 14–18 (5 days) has been approved and they've been notified."*

> **What to notice:** Sam's notification bell lights up within 30 seconds. Log back in as `employee@aria.dev` to see the bell badge and the approval message in the dropdown.

### 2d. Verify on the Leave page

Navigate to **Leave**. Sam's Jul 14–18 request now shows `Approved`. The Leave page can also be used to approve/reject directly using the Approve and Reject buttons without the agent.

### 2e. View the team calendar

Navigate to **Calendar**. The approved leave for Sam appears as a chip on the July dates. Pending requests show in a lighter style.

---

## Scenario 3 — Payroll Lookup via Agent

**Stay logged in as `manager@aria.dev`**, or log in as `employee@aria.dev`.

Navigate to **Chat**. Type:

> What was my net salary for April 2026?

Expected: Agent calls `get_payroll_summary`, returns:
- **Manager:** Gross $12,500 CAD / Net $8,500 CAD
- **Employee (Sam):** Gross $7,800 CAD / Net $5,460 CAD

Navigate to **Payroll** to see the full pay history table with all 4 months (March–June 2026).

---

## Scenario 4 — HR Admin Manages Records

**Log in as `admin@aria.dev` / `admin123`**

### 4a. Employee management

Navigate to **Employees** (visible in the sidebar under **Admin**). The full employee list appears with active/inactive counts. Click **+ New employee** to create a record, or **Edit** on an existing one.

### 4b. Policy management

Navigate to **Policies**. Click any policy to read its content. As an admin, **Edit** and **Delete** buttons appear in the policy drawer. Click **+ New policy** to author a new policy. Newly created policies are immediately available to the agent.

---

## Key Things to Highlight

| Feature | Where to look |
|---|---|
| Async agent with tool trace | Chat → expand "Agent thinking" chevron |
| Agent enforces authorization | Try approving a request from a non-direct-report |
| Auto-notifications on leave actions | Bell badge after approve/reject or submit |
| Session history | Sidebar lists recent conversations; click to resume |
| Real HR data, no hallucination | Agent cites policy version and dates from DB |

---

## Access Control Smoke Test

To demonstrate that authorization is enforced server-side (not just in the UI):

1. Log in as `employee@aria.dev`.
2. In Chat, type: *"Approve Sarah Chen's leave request."*
3. Expected: Agent refuses — Sam is not Sarah's manager, so `update_leave_status` returns an authorization error.

This proves the agent cannot be prompted into taking unauthorized actions.

---

## Reset Seed Data

If the database gets into a dirty state after the demo:

```bash
docker compose down -v
docker compose up --build
```

This wipes all volumes and re-seeds from scratch.
