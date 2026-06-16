import { useCallback, useEffect, useMemo, useState } from 'react'
import { leaveApi, type SubmitLeaveRequestPayload } from '@/api/leave'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'
import { formatDateRange, formatLeaveType } from '@/utils/leaveFormatting'

type Filter = 'all' | 'pending' | 'approved' | 'rejected' | 'team'
type TaggedRequest = LeaveRequest & { isOwn: boolean }

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'team',     label: 'My team' },
]

const STATUS_LABELS: Record<LeaveStatus, string> = {
  approved:  'Approved',
  cancelled: 'Cancelled',
  pending:   'Pending',
  rejected:  'Rejected',
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}

function Modal({ children, onClose, title }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div aria-modal="true" className="modal-overlay" onClick={onClose} role="dialog">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button aria-label="Close" className="btn-icon" onClick={onClose} type="button">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function NewRequestForm({ error, isSubmitting, onClose, onSubmit }: {
  error: string | null
  isSubmitting: boolean
  onClose: () => void
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
  }

  return (
    <form className="leave-request-form" onSubmit={(e) => void handleSubmit(e)}>
      {error && <div className="toast toast-error" role="alert">{error}</div>}
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
        <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          disabled={isSubmitting || !startDate || !endDate}
          type="submit"
        >
          {isSubmitting ? 'Submitting...' : 'Submit request'}
        </button>
      </div>
    </form>
  )
}

function RejectModal({ isActing, onClose, onReject }: {
  isActing: boolean
  onClose: () => void
  onReject: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    onReject(reason.trim())
    onClose()
  }

  return (
    <Modal onClose={onClose} title="Reject leave request">
      <form className="leave-request-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Rejection reason</span>
          <textarea
            autoFocus
            className="input textarea"
            disabled={isActing}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required"
            required
            value={reason}
          />
        </label>
        <div className="leave-form-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">Cancel</button>
          <button
            className="btn btn-danger btn-sm"
            disabled={isActing || !reason.trim()}
            type="submit"
          >
            {isActing ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export interface LeavePageViewProps {
  myRequests: LeaveRequest[]
  teamRequests: LeaveRequest[]
  isLoading: boolean
  error: string | null
  actingRequestId: string | null
  isSubmitting: boolean
  submitError: string | null
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reason: string) => void
  onSubmitLeave: (payload: SubmitLeaveRequestPayload) => Promise<void>
  onRetry: () => void
}

export function LeavePageView({
  actingRequestId,
  error,
  isLoading,
  isSubmitting,
  myRequests,
  onApprove,
  onReject,
  onRetry,
  onSubmitLeave,
  submitError,
  teamRequests,
}: LeavePageViewProps) {
  const [activeFilter, setActiveFilter] = useState<Filter>('all')
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null)

  const combined: TaggedRequest[] = useMemo(() => [
    ...myRequests.map((r) => ({ ...r, isOwn: true })),
    ...teamRequests.map((r) => ({ ...r, isOwn: false })),
  ], [myRequests, teamRequests])

  const filtered = useMemo(() => combined.filter((r) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'team') return !r.isOwn
    return r.status === activeFilter
  }), [combined, activeFilter])

  return (
    <div className="lp">
      <div className="ph">
        <span className="ptitle">Leave management</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowNewRequest(true)}
          type="button"
        >
          + New request
        </button>
      </div>

      {error && (
        <div className="toast toast-error" role="alert" style={{ margin: '12px 16px 0' }}>
          {error}{' '}
          <button className="btn-link" onClick={onRetry} type="button">Retry</button>
        </div>
      )}

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            className={`filter-pill${activeFilter === f.key ? ' active' : ''}`}
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="lt-empty">Loading leave requests...</div>
      ) : (
        <div className="ltable">
          <div className="lt-head">
            <div className="lt-hc">Employee</div>
            <div className="lt-hc">Type</div>
            <div className="lt-hc">Dates</div>
            <div className="lt-hc">Status</div>
            <div className="lt-hc">Action</div>
          </div>
          {filtered.length === 0 ? (
            <div className="lt-empty">No requests</div>
          ) : (
            filtered.map((request) => {
              const canAct = !request.isOwn && request.status === 'pending'
              const isActing = actingRequestId === request.id
              return (
                <div className="lt-row" key={request.id}>
                  <div className="lt-c">
                    <div className="avatar avatar-sm" style={{ flexShrink: 0, fontSize: '9px' }}>
                      {(request.employee_name ?? request.employee_id).slice(0, 2).toUpperCase()}
                    </div>
                    {request.isOwn ? 'Me' : (request.employee_name ?? `Employee ${request.employee_id.slice(0, 8)}`)}
                  </div>
                  <div className="lt-c m">{formatLeaveType(request.leave_type)}</div>
                  <div className="lt-c m">{formatDateRange(request.start_date, request.end_date)}</div>
                  <div className="lt-c"><StatusBadge status={request.status} /></div>
                  <div className="lt-c">
                    {canAct && (
                      <>
                        <button
                          className="act-b"
                          disabled={isActing}
                          onClick={() => onApprove(request.id)}
                          type="button"
                        >
                          {isActing ? '...' : 'Approve'}
                        </button>
                        <button
                          className="act-b"
                          disabled={isActing}
                          onClick={() => setRejectingRequest(request)}
                          type="button"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {showNewRequest && (
        <Modal onClose={() => setShowNewRequest(false)} title="New leave request">
          <NewRequestForm
            error={submitError}
            isSubmitting={isSubmitting}
            onClose={() => setShowNewRequest(false)}
            onSubmit={async (payload) => {
              await onSubmitLeave(payload)
              setShowNewRequest(false)
            }}
          />
        </Modal>
      )}

      {rejectingRequest && (
        <RejectModal
          isActing={actingRequestId === rejectingRequest.id}
          onClose={() => setRejectingRequest(null)}
          onReject={(reason) => {
            onReject(rejectingRequest.id, reason)
            setRejectingRequest(null)
          }}
        />
      )}
    </div>
  )
}

export default function LeavePage() {
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [teamRequests, setTeamRequests] = useState<LeaveRequest[]>([])
  const [actingRequestId, setActingRequestId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [mine, team] = await Promise.all([
        leaveApi.getMyLeaveRequests(),
        leaveApi.getPendingTeamLeaveRequests(),
      ])
      setMyRequests(mine)
      setTeamRequests(team)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected API error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const handleApprove = async (requestId: string) => {
    setActingRequestId(requestId)
    setError(null)
    try {
      await leaveApi.approveLeaveRequest(requestId)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve request')
    } finally {
      setActingRequestId(null)
    }
  }

  const handleReject = async (requestId: string, reason: string) => {
    setActingRequestId(requestId)
    setError(null)
    try {
      await leaveApi.rejectLeaveRequest(requestId, { rejection_reason: reason })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject request')
    } finally {
      setActingRequestId(null)
    }
  }

  const handleSubmitLeave = async (payload: SubmitLeaveRequestPayload) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await leaveApi.submitLeaveRequest(payload)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit request'
      setSubmitError(message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <LeavePageView
      actingRequestId={actingRequestId}
      error={error}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      myRequests={myRequests}
      onApprove={(requestId) => void handleApprove(requestId)}
      onReject={(requestId, reason) => void handleReject(requestId, reason)}
      onRetry={() => void loadData()}
      onSubmitLeave={handleSubmitLeave}
      submitError={submitError}
      teamRequests={teamRequests}
    />
  )
}
