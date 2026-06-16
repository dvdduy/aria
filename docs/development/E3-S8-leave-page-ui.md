# E3-S8 Leave Page UI

**Story:** As a user, I can review leave requests from the Leave page UI.  
**Epic:** E3 - Leave Workflow  
**Priority:** P1  
**Recommended next implementation task:** Yes

## Why This Matters

The backend leave workflow is now strong enough to expose in the product. This story turns the tested API behavior into a usable frontend slice, which is the first place the project starts to feel like a complete HR tool instead of isolated backend endpoints.

This is also a good learning step because it connects:

- React page state,
- typed API calls,
- protected JWT requests,
- loading, empty, and error states,
- manager-specific actions,
- Vitest component tests.

Recommendation: keep the frontend on Vite + React for this project. Do not move to Next.js yet. The app is an authenticated workflow tool, not a content-heavy site, and Vite keeps the learning surface smaller while still supporting professional React patterns.

## Current State

Already available:

- `frontend/src/api/client.ts` has a shared Axios client.
- The client reads `aria_token` from `sessionStorage`.
- `frontend/src/router.tsx` already routes `/leave` to `LeavePage`.
- `frontend/src/pages/LeavePage.tsx` exists as a placeholder.
- `frontend/src/types/models.ts` already has `LeaveRequest`, `LeaveStatus`, and `LeaveType`.
- `frontend/package.json` already includes Vitest and React Testing Library.
- Backend leave endpoints are implemented and tested.

Backend endpoints available for this UI:

```text
GET  /api/leave/mine
POST /api/leave/mine
GET  /api/leave/team/pending
GET  /api/leave/{request_id}
POST /api/leave/{request_id}/approve
POST /api/leave/{request_id}/reject
```

Current frontend gap:

- `LeavePage` does not call the backend.
- No leave API wrapper exists yet.
- No frontend tests exist for leave UI behavior.
- The current `LeaveRequest` type is missing `approved_by` and `approved_at`, which the backend response includes.

## Recommended Scope

Build the first real Leave page as a focused vertical slice:

1. Add a typed leave API module.
2. Update frontend leave types to match backend responses.
3. Render "My requests" from `GET /api/leave/mine`.
4. Render "Team pending" from `GET /api/leave/team/pending`.
5. Show approve and reject controls for pending team requests.
6. Refresh team and personal data after a successful approve or reject action.

Keep the first implementation intentionally modest. A submit form can be added either at the end of this story or as the next UI story. Since this user story says "review leave requests", the core of the story is list, inspect, and manager decision visibility.

## UX Shape

Use the existing design tokens from `frontend/src/styles`.

Recommended layout:

- Page header with title and compact status summary.
- Two-column desktop layout:
  - left: "My leave requests",
  - right: "Team pending".
- Single-column stacked layout on smaller screens.
- Status badges using existing status styles from `components.css`.
- Empty states that are useful but short:
  - no personal requests,
  - no pending team requests.
- Inline error message when API loading fails.
- Disable action buttons while approve or reject is in progress.

Avoid a large marketing-style page. This should feel like a practical HR work surface.

## TDD Plan

Use Vitest and React Testing Library.

If test setup is missing during implementation, add the smallest setup needed:

- `frontend/src/test/setup.ts`
- `frontend/vitest.config.ts` or update existing Vite config if present
- `@testing-library/jest-dom` only if assertions need it

Do not add a new frontend framework.

### Step 1 - API Contract Tests

Create tests for the leave API wrapper.

Expected file:

```text
frontend/src/api/leave.test.ts
```

Recommended tests:

- `getMyLeaveRequests` calls `/api/leave/mine`.
- `getPendingTeamLeaveRequests` calls `/api/leave/team/pending`.
- `approveLeaveRequest(id)` posts to `/api/leave/{id}/approve`.
- `rejectLeaveRequest(id, reason)` posts to `/api/leave/{id}/reject` with a reason body.

Mock the shared Axios client rather than calling the real backend.

Expected red result:

```text
Cannot find module './leave'
```

### Step 2 - Page Loading Test

Create:

```text
frontend/src/pages/LeavePage.test.tsx
```

Recommended test:

- mock API returns one personal leave request,
- render `LeavePage`,
- assert the leave type, date range, days, and status appear.

Expected red result:

```text
Unable to find rendered leave request
```

### Step 3 - Team Pending Test

Add a test where the team API returns one pending direct-report request.

Assert:

- employee/request details appear,
- Approve button appears,
- Reject button appears.

### Step 4 - Approval Action Test

Add a test:

- click Approve,
- assert `approveLeaveRequest` is called with the request id,
- assert the page refreshes the pending list.

### Step 5 - Rejection Action Test

Add a test:

- enter or provide a rejection reason,
- click Reject,
- assert `rejectLeaveRequest` is called with the request id and reason,
- assert the page refreshes the pending list.

For the first version, a simple `prompt()` for rejection reason is acceptable if we want to keep scope small. A small inline textarea is more polished and easier to test.

## Implementation Plan

### Step 1 - Update Types

In `frontend/src/types/models.ts`, update `LeaveRequest`:

```ts
export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_requested: number
  status: LeaveStatus
  reason: string | null
  approved_by?: string | null
  approved_at?: string | null
  created_at: string
}
```

If the backend later returns employee display names for team requests, add those fields then. Do not fake them in the shared type.

### Step 2 - Add Leave API Module

Create:

```text
frontend/src/api/leave.ts
```

Recommended shape:

```ts
import client from './client'
import type { LeaveRequest } from '@/types/models'

export interface RejectLeaveRequestPayload {
  rejection_reason: string
}

export const leaveApi = {
  getMyLeaveRequests: async () => {
    const { data } = await client.get<LeaveRequest[]>('/api/leave/mine')
    return data
  },
  getPendingTeamLeaveRequests: async () => {
    const { data } = await client.get<LeaveRequest[]>('/api/leave/team/pending')
    return data
  },
  approveLeaveRequest: async (requestId: string) => {
    const { data } = await client.post<LeaveRequest>(`/api/leave/${requestId}/approve`)
    return data
  },
  rejectLeaveRequest: async (requestId: string, payload: RejectLeaveRequestPayload) => {
    const { data } = await client.post<LeaveRequest>(`/api/leave/${requestId}/reject`, payload)
    return data
  },
}
```

### Step 3 - Implement Page State

In `frontend/src/pages/LeavePage.tsx`, start with plain React state:

- `myRequests`,
- `teamRequests`,
- `isLoading`,
- `error`,
- `actingRequestId`.

React Query is already installed, but plain state is easier for this first learning slice. We can move to React Query when multiple pages share cached server state.

Recommended helpers:

- `loadLeaveData()`,
- `handleApprove(requestId)`,
- `handleReject(requestId, reason)`,
- `formatDate(value)`,
- `formatLeaveType(value)`.

### Step 4 - Add Basic Components Only If Needed

Prefer local functions inside `LeavePage.tsx` for the first implementation:

- `StatusBadge`,
- `LeaveRequestList`,
- `TeamPendingList`.

Extract components only after the page works and tests are passing.

### Step 5 - Style With Existing Tokens

Use semantic classes if they already fit. Add only small CSS extensions if the page needs them.

Expected CSS touch points:

- `frontend/src/styles/components.css`
- possibly `frontend/src/styles/index.css`

Avoid inline styles for the final implementation. `DevLoginPage` currently uses inline styles, but the main app pages should use the tokenized stylesheet approach.

## Files To Touch

Expected files:

- `frontend/src/types/models.ts`
- `frontend/src/api/leave.ts`
- `frontend/src/api/leave.test.ts`
- `frontend/src/pages/LeavePage.tsx`
- `frontend/src/pages/LeavePage.test.tsx`
- `frontend/src/styles/components.css`
- frontend test setup files only if missing
- `docs/PROJECT_PLAN.md` when implementation is complete

Avoid touching:

- backend leave service behavior,
- backend database models,
- auth token format,
- Next.js or app framework configuration.

## Acceptance Criteria

This story is done when:

- `/leave` loads the authenticated user's leave requests.
- `/leave` loads pending direct-report leave requests for managers.
- empty states render when either list is empty.
- loading state renders during API calls.
- API errors render a clear message.
- approve action calls the backend and refreshes data.
- reject action requires a reason, calls the backend, and refreshes data.
- action buttons are disabled while a request is being processed.
- frontend tests cover the API wrapper and page behavior.
- frontend type-check passes.
- frontend build passes.
- project plan marks `E3-S8` as `Verified` only after tests or a documented manual verification pass.

## Verification

From `frontend/`:

```bash
npm test -- --run
npm run type-check
npm run build
```

Manual verification:

```bash
npm run dev
```

Then:

1. Start the backend API.
2. Open the frontend app.
3. Use `/dev` to sign in as Manager.
4. Navigate to `/leave`.
5. Confirm personal leave requests load.
6. Confirm team pending requests load.
7. Approve one pending request.
8. Confirm it disappears from pending requests or changes status after refresh.
9. Repeat with rejection and a reason.
10. Sign in as Employee and confirm team pending actions are not visible or no team pending records appear.

Expected final result:

```text
frontend tests pass
frontend type-check passes
frontend build passes
manual /leave flow works for Manager and Employee
```

## Commit Message

```text
E3-S8: wire leave page to leave workflow APIs
```

## Next Story After This

Recommended next story:

**E5-S1 - As the backend, agent tool execution is routed through an allowlisted tool registry.**

That keeps the project moving toward the main portfolio claim: AI-assisted HR actions with backend-enforced authorization.
