import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeesApi } from '@/api/employees'
import { leaveApi } from '@/api/leave'
import type { Employee, LeaveRequest } from '@/types/models'

// ── helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'var(--color-info-50)',  color: 'var(--color-info-800)'  },
  { bg: 'var(--color-teal-50)', color: 'var(--color-teal-800)'  },
  { bg: 'var(--color-pink-50)', color: 'var(--color-pink-800)'  },
  { bg: 'var(--color-green-50)',color: 'var(--color-green-800)' },
  { bg: 'var(--color-brand-50)',color: 'var(--color-brand-800)' },
]

const LEAVE_TYPE_STYLE: Record<string, { background: string; color: string }> = {
  annual:   { background: 'var(--color-info-50)',    color: 'var(--color-info-800)'    },
  sick:     { background: 'var(--color-pink-50)',    color: 'var(--color-pink-800)'    },
  parental: { background: 'var(--color-teal-50)',    color: 'var(--color-teal-800)'    },
  unpaid:   { background: 'var(--color-bg-tertiary)',color: 'var(--color-text-secondary)' },
}

function decodeTokenClaims(token: string): { name?: string } {
  try { return JSON.parse(atob(token.split('.')[1])) as { name?: string } }
  catch { return {} }
}

function getFirstName(): string {
  const token = sessionStorage.getItem('aria_token') ?? ''
  const { name } = decodeTokenClaims(token)
  if (!name) return ''
  return name.split(/\s+/)[0]
}

function greeting(): string {
  const h = new Date().getHours()
  const first = getFirstName()
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return first ? `${base}, ${first}` : base
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function isOnLeaveToday(r: LeaveRequest): boolean {
  const today = getTodayStr()
  return r.status === 'approved' && r.start_date <= today && r.end_date >= today
}

function avatarColors(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── sub-components ────────────────────────────────────────────────────────────

function OutTodayChip({ name }: { name: string }) {
  const col = avatarColors(name)
  return (
    <div className="dash-out-chip">
      <div className="dash-out-av" style={{ background: col.bg, color: col.color }}>
        {getInitials(name)}
      </div>
      <span>{name}</span>
    </div>
  )
}

function UpcomingRow({ request }: { request: LeaveRequest }) {
  const typeStyle = LEAVE_TYPE_STYLE[request.leave_type] ?? LEAVE_TYPE_STYLE.unpaid
  const statusClass = request.status === 'approved' ? 'badge-approved' : 'badge-pending'
  return (
    <div className="list-row">
      <span className="dash-type-pill" style={typeStyle}>
        {request.leave_type}
      </span>
      <div style={{ flex: 1 }}>
        <div className="lname">{formatDateRange(request.start_date, request.end_date)}</div>
        <div className="lmeta">
          {request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
        </div>
      </div>
      <span className={`badge ${statusClass}`}>
        {request.status === 'approved' ? 'Approved' : 'Pending'}
      </span>
    </div>
  )
}

function RejectModal({ isActing, onClose, onReject }: {
  isActing: boolean
  onClose: () => void
  onReject: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { textareaRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Reject leave request</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close" type="button">✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '2px' }}>
          <label className="field">
            <span className="field-label">Rejection reason</span>
            <textarea
              ref={textareaRef}
              className="input textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
              disabled={isActing}
            />
          </label>
          <div className="leave-form-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">Cancel</button>
            <button
              className="btn btn-danger btn-sm"
              disabled={isActing || !reason.trim()}
              onClick={() => { if (reason.trim()) onReject(reason.trim()) }}
              type="button"
            >
              {isActing ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingRow({ actingId, onApprove, onReject, request }: {
  request: LeaveRequest
  actingId: string | null
  onApprove: (id: string) => void
  onReject: (request: LeaveRequest) => void
}) {
  const name = request.employee_name ?? ''
  const colors = avatarColors(name)
  const isActing = actingId === request.id
  return (
    <div className="list-row">
      <div className="av" style={{ background: colors.bg, color: colors.color, flexShrink: 0 }}>
        {name ? getInitials(name) : '??'}
      </div>
      <div style={{ flex: 1 }}>
        <div className="lname">{name || 'Unknown'}</div>
        <div className="lmeta">
          {request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)} · {request.days_requested} days · {formatDateRange(request.start_date, request.end_date)}
        </div>
      </div>
      <button
        className="act-b"
        disabled={isActing}
        onClick={() => onApprove(request.id)}
        type="button"
      >
        {isActing ? '…' : 'Approve'}
      </button>
      <button
        className="act-b act-b-danger"
        disabled={isActing}
        onClick={() => onReject(request)}
        type="button"
      >
        Reject
      </button>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [profile, setProfile] = useState<Employee | null>(null)
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [teamPending, setTeamPending] = useState<LeaveRequest[]>([])
  const [teamAll, setTeamAll] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadData = () =>
    Promise.allSettled([
      employeesApi.getMe(),
      leaveApi.getMyLeaveRequests(),
      leaveApi.getPendingTeamLeaveRequests(),
      leaveApi.getAllTeamLeaveRequests(),
    ]).then(([prof, mine, pending, all]) => {
      if (prof.status === 'fulfilled') setProfile(prof.value)
      if (mine.status === 'fulfilled') setMyRequests(mine.value)
      if (pending.status === 'fulfilled') setTeamPending(pending.value)
      if (all.status === 'fulfilled') setTeamAll(all.value)
      setIsLoading(false)
    })

  useEffect(() => { void loadData() }, [])

  const handleApprove = async (id: string) => {
    setActingId(id)
    setActionError(null)
    try {
      await leaveApi.approveLeaveRequest(id)
      await loadData()
    } catch {
      setActionError('Failed to approve request.')
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (id: string, reason: string) => {
    setActingId(id)
    setActionError(null)
    try {
      await leaveApi.rejectLeaveRequest(id, { rejection_reason: reason })
      setRejectingRequest(null)
      await loadData()
    } catch {
      setActionError('Failed to reject request.')
    } finally {
      setActingId(null)
    }
  }

  const todayStr = getTodayStr()

  const myAnnualApproved = myRequests
    .filter((r) => r.status === 'approved' && r.leave_type === 'annual')
    .reduce((sum, r) => sum + r.days_requested, 0)
  const leaveBalance = Math.max(0, 20 - myAnnualApproved)

  const outToday = useMemo(
    () => teamAll.filter(isOnLeaveToday),
    [teamAll],
  )

  const upcoming = useMemo(
    () =>
      myRequests
        .filter(
          (r) =>
            (r.status === 'approved' || r.status === 'pending') &&
            r.end_date >= todayStr,
        )
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 4),
    [myRequests, todayStr],
  )

  const subtitle = [formatToday(), profile?.role].filter(Boolean).join(' · ')

  return (
    <div className="dash">
      <div className="dash-greet">{greeting()}</div>
      <div className="dash-sub">{subtitle}</div>

      {/* stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Leave balance</div>
          <div className="stat-val" style={{ color: 'var(--color-success-600)' }}>
            {isLoading ? '—' : leaveBalance}
          </div>
          <div className="stat-sub">{isLoading ? '' : `${myAnnualApproved} days used this year`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Out today</div>
          <div className="stat-val">{isLoading ? '—' : outToday.length}</div>
          <div className="stat-sub">team members on leave</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending approvals</div>
          <div className="stat-val" style={teamPending.length > 0 ? { color: 'var(--color-warning-600)' } : undefined}>
            {isLoading ? '—' : teamPending.length}
          </div>
          <div className="stat-sub">team requests</div>
        </div>
      </div>

      {/* who's out today */}
      {!isLoading && outToday.length > 0 && (
        <>
          <div className="sec-title">Out today</div>
          <div className="dash-out-row">
            {outToday.map((r) => (
              <OutTodayChip key={r.id} name={r.employee_name ?? 'Unknown'} />
            ))}
          </div>
        </>
      )}

      {/* my upcoming leave */}
      {!isLoading && upcoming.length > 0 && (
        <>
          <div className="sec-title">My upcoming leave</div>
          <div className="list-card" style={{ marginBottom: 'var(--space-4)' }}>
            {upcoming.map((r) => <UpcomingRow key={r.id} request={r} />)}
          </div>
        </>
      )}

      {/* pending team requests */}
      {!isLoading && teamPending.length > 0 && (
        <>
          <div className="sec-title">Pending requests</div>
          {actionError && (
            <div className="toast toast-error" style={{ marginBottom: 8 }}>{actionError}</div>
          )}
          <div className="list-card" style={{ marginBottom: 'var(--space-4)' }}>
            {teamPending.map((r) => (
              <PendingRow
                key={r.id}
                request={r}
                actingId={actingId}
                onApprove={(id) => void handleApprove(id)}
                onReject={(req) => setRejectingRequest(req)}
              />
            ))}
          </div>
        </>
      )}

      {rejectingRequest && (
        <RejectModal
          isActing={actingId === rejectingRequest.id}
          onClose={() => setRejectingRequest(null)}
          onReject={(reason) => void handleReject(rejectingRequest.id, reason)}
        />
      )}

      {/* quick actions */}
      <div className="sec-title">Quick actions</div>
      <div className="qa-grid">
        <Link className="qa-card" to="/chat">
          <div className="qa-ico">💬</div>
          <div className="qa-t">Ask HR Agent</div>
          <div className="qa-d">Approve leave, query policies, check payroll</div>
        </Link>
        <Link className="qa-card" to="/leave">
          <div className="qa-ico">📅</div>
          <div className="qa-t">Manage leave</div>
          <div className="qa-d">Submit and review leave requests</div>
        </Link>
        <Link className="qa-card" to="/policies">
          <div className="qa-ico">📄</div>
          <div className="qa-t">HR policies</div>
          <div className="qa-d">Browse company guidelines</div>
        </Link>
        <Link className="qa-card" to="/payroll">
          <div className="qa-ico">💳</div>
          <div className="qa-t">Payroll records</div>
          <div className="qa-d">View your salary summaries</div>
        </Link>
      </div>
    </div>
  )
}
