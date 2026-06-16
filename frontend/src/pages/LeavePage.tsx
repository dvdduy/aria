import { useCallback, useEffect, useMemo, useState } from 'react'
import { leaveApi } from '@/api/leave'
import type { LeaveRequest, LeaveStatus } from '@/types/models'
import { formatDateRange, formatLeaveType } from '@/utils/leaveFormatting'

type RejectReasons = Record<string, string>

export interface LeavePageViewProps {
  myRequests: LeaveRequest[]
  teamRequests: LeaveRequest[]
  isLoading: boolean
  error: string | null
  actingRequestId: string | null
  rejectReasons: RejectReasons
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  onRejectReasonChange: (requestId: string, value: string) => void
  onRetry: () => void
}

const statusLabels: Record<LeaveStatus, string> = {
  approved: 'Approved',
  cancelled: 'Cancelled',
  pending: 'Pending',
  rejected: 'Rejected',
}

function countByStatus(requests: LeaveRequest[], status: LeaveStatus) {
  return requests.filter((request) => request.status === status).length
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabels[status]}</span>
}

function LeaveTable({
  emptyBody,
  emptyTitle,
  requests,
}: {
  emptyBody: string
  emptyTitle: string
  requests: LeaveRequest[]
}) {
  if (requests.length === 0) {
    return (
      <div className="empty-state leave-empty-state">
        <div className="empty-state-title">{emptyTitle}</div>
        <div className="empty-state-body">{emptyBody}</div>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table className="table leave-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>{formatLeaveType(request.leave_type)}</td>
              <td className="muted">
                {formatDateRange(request.start_date, request.end_date)}
              </td>
              <td>{request.days_requested}</td>
              <td>
                <StatusBadge status={request.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamPendingList({
  actingRequestId,
  onApprove,
  onReject,
  onRejectReasonChange,
  rejectReasons,
  requests,
}: Pick<
  LeavePageViewProps,
  | 'actingRequestId'
  | 'onApprove'
  | 'onReject'
  | 'onRejectReasonChange'
  | 'rejectReasons'
> & { requests: LeaveRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="empty-state leave-empty-state">
        <div className="empty-state-title">No pending team requests</div>
        <div className="empty-state-body">
          Direct-report requests that need your decision will appear here.
        </div>
      </div>
    )
  }

  return (
    <div className="leave-team-list">
      {requests.map((request) => {
        const isActing = actingRequestId === request.id
        const reason = rejectReasons[request.id] ?? ''

        return (
          <article className="leave-team-item" key={request.id}>
            <div className="leave-team-item-main">
              <div>
                <div className="leave-request-title">
                  {formatLeaveType(request.leave_type)}
                </div>
                <div className="leave-request-meta">
                  {formatDateRange(request.start_date, request.end_date)} ·{' '}
                  {request.days_requested} days · Employee {request.employee_id}
                </div>
              </div>
              <StatusBadge status={request.status} />
            </div>

            {request.reason ? (
              <p className="leave-request-reason">{request.reason}</p>
            ) : null}

            <label className="field leave-reject-field">
              <span className="field-label">Rejection reason</span>
              <textarea
                className="input textarea"
                disabled={isActing}
                onChange={(event) =>
                  onRejectReasonChange(request.id, event.currentTarget.value)
                }
                placeholder="Required only when rejecting"
                value={reason}
              />
            </label>

            <div className="leave-team-actions">
              <button
                className="btn btn-primary btn-sm"
                disabled={isActing}
                onClick={() => onApprove(request.id)}
                type="button"
              >
                {isActing ? 'Working...' : 'Approve'}
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={isActing || reason.trim().length === 0}
                onClick={() => onReject(request.id)}
                type="button"
              >
                Reject
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function LeavePageView({
  actingRequestId,
  error,
  isLoading,
  myRequests,
  onApprove,
  onReject,
  onRejectReasonChange,
  onRetry,
  rejectReasons,
  teamRequests,
}: LeavePageViewProps) {
  const summary = useMemo(
    () => ({
      approved: countByStatus(myRequests, 'approved'),
      pending: countByStatus(myRequests, 'pending'),
      rejected: countByStatus(myRequests, 'rejected'),
      teamPending: teamRequests.length,
    }),
    [myRequests, teamRequests],
  )

  return (
    <main className="leave-page">
      <header className="leave-page-header">
        <div>
          <p className="leave-eyebrow">Leave workflow</p>
          <h1>Leave requests</h1>
          <p className="leave-page-subtitle">
            Review your leave status and make decisions on pending team requests.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          disabled={isLoading}
          onClick={onRetry}
          type="button"
        >
          Refresh
        </button>
      </header>

      <section aria-label="Leave summary" className="leave-summary-grid">
        <div className="metric-card">
          <div className="metric-label">My pending</div>
          <div className="metric-value">{summary.pending}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Approved</div>
          <div className="metric-value">{summary.approved}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Rejected</div>
          <div className="metric-value">{summary.rejected}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Team pending</div>
          <div className="metric-value">{summary.teamPending}</div>
        </div>
      </section>

      {error ? (
        <div className="toast toast-error leave-error" role="alert">
          <div>
            <strong>Could not load leave requests.</strong>
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="card leave-loading">Loading leave requests...</div>
      ) : (
        <section className="leave-content-grid">
          <div className="card leave-section">
            <div className="card-header">
              <div>
                <h2 className="card-title">My requests</h2>
                <p className="leave-section-subtitle">
                  Your submitted leave requests and current statuses.
                </p>
              </div>
            </div>
            <LeaveTable
              emptyBody="Submitted leave requests will appear here once they exist."
              emptyTitle="No leave requests yet"
              requests={myRequests}
            />
          </div>

          <div className="card leave-section">
            <div className="card-header">
              <div>
                <h2 className="card-title">Team pending</h2>
                <p className="leave-section-subtitle">
                  Requests from direct reports waiting for a decision.
                </p>
              </div>
            </div>
            <TeamPendingList
              actingRequestId={actingRequestId}
              onApprove={onApprove}
              onReject={onReject}
              onRejectReasonChange={onRejectReasonChange}
              rejectReasons={rejectReasons}
              requests={teamRequests}
            />
          </div>
        </section>
      )}
    </main>
  )
}

export default function LeavePage() {
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [teamRequests, setTeamRequests] = useState<LeaveRequest[]>([])
  const [rejectReasons, setRejectReasons] = useState<RejectReasons>({})
  const [actingRequestId, setActingRequestId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLeaveData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [mine, teamPending] = await Promise.all([
        leaveApi.getMyLeaveRequests(),
        leaveApi.getPendingTeamLeaveRequests(),
      ])
      setMyRequests(mine)
      setTeamRequests(teamPending)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected API error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLeaveData()
  }, [loadLeaveData])

  const handleApprove = async (requestId: string) => {
    setActingRequestId(requestId)
    setError(null)
    try {
      await leaveApi.approveLeaveRequest(requestId)
      await loadLeaveData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve request')
    } finally {
      setActingRequestId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    const rejectionReason = rejectReasons[requestId]?.trim()
    if (!rejectionReason) return

    setActingRequestId(requestId)
    setError(null)
    try {
      await leaveApi.rejectLeaveRequest(requestId, {
        rejection_reason: rejectionReason,
      })
      setRejectReasons((current) => {
        const next = { ...current }
        delete next[requestId]
        return next
      })
      await loadLeaveData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject request')
    } finally {
      setActingRequestId(null)
    }
  }

  const handleRejectReasonChange = (requestId: string, value: string) => {
    setRejectReasons((current) => ({ ...current, [requestId]: value }))
  }

  return (
    <LeavePageView
      actingRequestId={actingRequestId}
      error={error}
      isLoading={isLoading}
      myRequests={myRequests}
      onApprove={(requestId) => void handleApprove(requestId)}
      onReject={(requestId) => void handleReject(requestId)}
      onRejectReasonChange={handleRejectReasonChange}
      onRetry={() => void loadLeaveData()}
      rejectReasons={rejectReasons}
      teamRequests={teamRequests}
    />
  )
}
