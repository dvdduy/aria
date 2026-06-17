import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeesApi } from '@/api/employees'
import { leaveApi } from '@/api/leave'
import type { Employee, LeaveRequest } from '@/types/models'

const AVATAR_COLORS = [
  { bg: 'var(--color-info-50)',  color: 'var(--color-info-800)'  },
  { bg: 'var(--color-teal-50)', color: 'var(--color-teal-800)'  },
  { bg: 'var(--color-pink-50)', color: 'var(--color-pink-800)'  },
  { bg: 'var(--color-green-50)',color: 'var(--color-green-800)' },
  { bg: 'var(--color-brand-50)',color: 'var(--color-brand-800)' },
]

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

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function isOnLeaveToday(r: LeaveRequest): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(r.start_date + 'T00:00:00')
  const end   = new Date(r.end_date   + 'T00:00:00')
  return r.status === 'approved' && start <= today && today <= end
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

function PendingRow({ request }: { request: LeaveRequest }) {
  const name = request.employee_name ?? ''
  const colors = avatarColors(name)
  return (
    <div className="list-row">
      <div className="av" style={{ background: colors.bg, color: colors.color, flexShrink: 0 }}>
        {name ? getInitials(name) : '??'}
      </div>
      <div>
        <div className="lname">{name || 'Unknown'}</div>
        <div className="lmeta">{request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)} · {request.days_requested} days</div>
      </div>
      <div className="ldates">{formatDateRange(request.start_date, request.end_date)}</div>
      <span className="badge-pend">Pending</span>
    </div>
  )
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Employee | null>(null)
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [teamPending, setTeamPending] = useState<LeaveRequest[]>([])
  const [teamAll, setTeamAll] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  const onLeaveToday = teamAll.filter(isOnLeaveToday).length

  const myAnnualApproved = myRequests
    .filter((r) => r.status === 'approved' && r.leave_type === 'annual')
    .reduce((sum, r) => sum + r.days_requested, 0)
  const leaveBalance = Math.max(0, 20 - myAnnualApproved)

  const subtitle = [formatToday(), profile?.role].filter(Boolean).join(' · ')

  return (
    <div className="dash">
      <div className="dash-greet">{greeting()}</div>
      <div className="dash-sub">{subtitle}</div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Pending approvals</div>
          <div className="stat-val" style={teamPending.length > 0 ? { color: 'var(--color-warning-600)' } : undefined}>
            {isLoading ? '—' : teamPending.length}
          </div>
          <div className="stat-sub">team requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On leave today</div>
          <div className="stat-val">{isLoading ? '—' : onLeaveToday}</div>
          <div className="stat-sub">of your team</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">My leave balance</div>
          <div className="stat-val" style={{ color: 'var(--color-success-600)' }}>
            {isLoading ? '—' : leaveBalance}
          </div>
          <div className="stat-sub">days remaining</div>
        </div>
      </div>

      {!isLoading && teamPending.length > 0 && (
        <>
          <div className="sec-title">Pending leave requests</div>
          <div className="list-card">
            {teamPending.map((r) => <PendingRow key={r.id} request={r} />)}
          </div>
        </>
      )}

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
