import { useCallback, useEffect, useMemo, useState } from 'react'
import { leaveApi, type SubmitLeaveRequestPayload } from '@/api/leave'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'
import { formatDateRange, formatLeaveType } from '@/utils/leaveFormatting'

type RejectReasons = Record<string, string>

export interface LeavePageViewProps {
  myRequests: LeaveRequest[]
  teamRequests: LeaveRequest[]
  isLoading: boolean
  error: string | null
  actingRequestId: string | null
  rejectReasons: RejectReasons
  isSubmitting: boolean
  submitError: string | null
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  onRejectReasonChange: (requestId: string, value: string) => void
  onSubmitLeave: (payload: SubmitLeaveRequestPayload) => Promise<void>
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

function RequestLeaveForm({
  isSubmitting,
  submitError,
  onSubmit,
}: {
  isSubmitting: boolean
  submitError: string | null
  onSubmit: (payload: SubmitLeaveRequestPayload) => Promise<void>
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) return
    await onSubmit({
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim() || undefined,
    })
    setLeaveType('annual')
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  return (
    <div className="card leave-section">
      <div className="card-header">
        <div>
          <h2 className="card-title">Request leave</h2>
          <p className="leave-section-subtitle">
            Submit a new leave request for your manager's review.
          </p>
        </div>
      </div>

      {submitError ? (
        <div className="toast toast-error leave-error" role="alert">
          {submitError}
        </div>
      ) : null}

      <form className="leave-request-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          <span className="field-label">Leave type</span>
          <select
            className="input select"
            disabled={isSubmitting}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            value={leaveType}
          >
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="parental">Parental</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </label>

        <div className="leave-date-row">
          <label className="field">
            <span className="field-label">Start date</span>
            <input
              className="input"
              disabled={isSubmitting}
              onChange={(e) => setStartDate(e.target.value)}
              required
              type="date"
              value={startDate}
            />
          </label>
          <label className="field">
            <span className="field-label">End date</span>
            <input
              className="input"
              disabled={isSubmitting}
              onChange={(e) => setEndDate(e.target.value)}
              required
              type="date"
              value={endDate}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Reason (optional)</span>
          <textarea
            className="input textarea"
            disabled={isSubmitting}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Helps your manager understand the context"
            value={reason}
          />
        </label>

        <div className="leave-form-footer">
          <button
            className="btn btn-primary btn-sm"
            disabled={isSubmitting || !startDate || !endDate}
            type="submit"
          >
            {isSubmitting ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function LeavePageView({
  actingRequestId,
  error,
  isLoading,
  isSubmitting,
  myRequests,
  onApprove,
  onReject,
  onRejectReasonChange,
  onRetry,
  onSubmitLeave,
  rejectReasons,
  submitError,
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
            Submit requests, review your leave status, and approve team requests.
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
        <>
          <RequestLeaveForm
            isSubmitting={isSubmitting}
            onSubmit={onSubmitLeave}
            submitError={submitError}
          />

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
        </>
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  const handleSubmitLeave = async (payload: SubmitLeaveRequestPayload) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await leaveApi.submitLeaveRequest(payload)
      await loadLeaveData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit request'
      setSubmitError(message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

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
      isSubmitting={isSubmitting}
      myRequests={myRequests}
      onApprove={(requestId) => void handleApprove(requestId)}
      onReject={(requestId) => void handleReject(requestId)}
      onRejectReasonChange={handleRejectReasonChange}
      onRetry={() => void loadLeaveData()}
      onSubmitLeave={handleSubmitLeave}
      rejectReasons={rejectReasons}
      submitError={submitError}
      teamRequests={teamRequests}
    />
  )
}
