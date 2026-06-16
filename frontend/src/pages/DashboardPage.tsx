import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leaveApi } from '@/api/leave'
import type { LeaveRequest } from '@/types/models'
import { formatDateRange, formatLeaveType } from '@/utils/leaveFormatting'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function PendingRow({ request }: { request: LeaveRequest }) {
  return (
    <div className="list-row">
      <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>
        {request.employee_id.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div className="lname">{formatLeaveType(request.leave_type)}</div>
        <div className="lmeta">{request.days_requested} days</div>
      </div>
      <div className="ldates">{formatDateRange(request.start_date, request.end_date)}</div>
      <span className="badge badge-pending">Pending</span>
    </div>
  )
}

export default function DashboardPage() {
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [teamPending, setTeamPending] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      leaveApi.getMyLeaveRequests(),
      leaveApi.getPendingTeamLeaveRequests(),
    ])
      .then(([mine, team]) => {
        setMyRequests(mine)
        setTeamPending(team)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const myPending  = myRequests.filter((r) => r.status === 'pending').length
  const myApproved = myRequests.filter((r) => r.status === 'approved').length

  return (
    <div className="dash">
      <div className="dash-greet">{greeting()}</div>
      <div className="dash-sub">{formatToday()}</div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Pending approvals</div>
          <div
            className="stat-val"
            style={teamPending.length > 0 ? { color: 'var(--color-warning-600)' } : undefined}
          >
            {isLoading ? '—' : teamPending.length}
          </div>
          <div className="stat-sub">team requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">My pending</div>
          <div className="stat-val">{isLoading ? '—' : myPending}</div>
          <div className="stat-sub">awaiting review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">My approved</div>
          <div
            className="stat-val"
            style={myApproved > 0 ? { color: 'var(--color-success-600)' } : undefined}
          >
            {isLoading ? '—' : myApproved}
          </div>
          <div className="stat-sub">this year</div>
        </div>
      </div>

      {!isLoading && teamPending.length > 0 && (
        <>
          <div className="sec-title">Pending team requests</div>
          <div className="list-card">
            {teamPending.map((r) => <PendingRow key={r.id} request={r} />)}
          </div>
        </>
      )}

      <div className="sec-title">Quick actions</div>
      <div className="qa-grid">
        <Link className="qa-card" to="/chat">
          <div className="qa-t">Ask HR Agent</div>
          <div className="qa-d">Approve leave, query policies, check payroll</div>
        </Link>
        <Link className="qa-card" to="/leave">
          <div className="qa-t">Manage leave</div>
          <div className="qa-d">Submit and review leave requests</div>
        </Link>
        <Link className="qa-card" to="/policies">
          <div className="qa-t">HR policies</div>
          <div className="qa-d">Browse company guidelines</div>
        </Link>
        <Link className="qa-card" to="/payroll">
          <div className="qa-t">Payroll records</div>
          <div className="qa-d">View your salary summaries</div>
        </Link>
      </div>
    </div>
  )
}
