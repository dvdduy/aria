import { useEffect, useMemo, useState } from 'react'
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

function avatarColors(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type EmployeeStatus =
  | { kind: 'out';     until: string }
  | { kind: 'pending'; from: string }
  | { kind: 'available' }

function resolveStatus(empId: string, allLeave: LeaveRequest[], today: string): EmployeeStatus {
  const empLeave = allLeave.filter((r) => r.employee_id === empId)

  // Check if on approved leave right now
  const activeApproved = empLeave.find(
    (r) => r.status === 'approved' && r.start_date <= today && r.end_date >= today,
  )
  if (activeApproved) return { kind: 'out', until: activeApproved.end_date }

  // Check if has upcoming approved leave (starting soon)
  const upcomingApproved = empLeave
    .filter((r) => r.status === 'approved' && r.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  if (upcomingApproved) return { kind: 'pending', from: upcomingApproved.start_date }

  // Check for pending request
  const pendingReq = empLeave
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  if (pendingReq) return { kind: 'pending', from: pendingReq.start_date }

  return { kind: 'available' }
}

// ── components ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EmployeeStatus }) {
  if (status.kind === 'out') {
    return (
      <span className="badge badge-rejected" style={{ background: 'var(--color-danger-50)', color: 'var(--color-danger-600)' }}>
        Out today · back {formatDate(status.until)}
      </span>
    )
  }
  if (status.kind === 'pending') {
    return (
      <span className="badge badge-pending">
        Leave from {formatDate(status.from)}
      </span>
    )
  }
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
      Available
    </span>
  )
}

function MemberRow({ employee, allLeave, today }: {
  employee: Employee
  allLeave: LeaveRequest[]
  today: string
}) {
  const col = avatarColors(employee.full_name)
  const status = resolveStatus(employee.id, allLeave, today)

  return (
    <div className="list-row">
      <div className="av" style={{ background: col.bg, color: col.color, flexShrink: 0 }}>
        {getInitials(employee.full_name)}
      </div>
      <div style={{ flex: 1 }}>
        <div className="lname">{employee.full_name}</div>
        <div className="lmeta">
          {[employee.role, employee.department].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      <StatusBadge status={status} />
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [reports, setReports] = useState<Employee[]>([])
  const [allLeave, setAllLeave] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      employeesApi.getDirectReports(),
      leaveApi.getAllTeamLeaveRequests(),
    ])
      .then(([emps, leave]) => {
        setReports(emps)
        setAllLeave(leave)
      })
      .catch(() => setError('Failed to load team information.'))
      .finally(() => setIsLoading(false))
  }, [])

  const today = getTodayStr()

  const outToday = useMemo(
    () => reports.filter((e) => resolveStatus(e.id, allLeave, today).kind === 'out').length,
    [reports, allLeave, today],
  )
  const pendingCount = useMemo(
    () => reports.filter((e) => resolveStatus(e.id, allLeave, today).kind === 'pending').length,
    [reports, allLeave, today],
  )

  return (
    <div className="pol-page">
      <div className="page-topbar">
        <span className="page-topbar-title">Team</span>
      </div>

      <div className="teamp">
        {isLoading && <div className="lt-empty">Loading…</div>}

        {error && (
          <div className="toast toast-error" style={{ margin: '0 0 12px' }}>{error}</div>
        )}

        {!isLoading && !error && (
          <>
            {/* summary stats */}
            <div className="stat-grid" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="stat-card">
                <div className="stat-label">Team size</div>
                <div className="stat-val">{reports.length}</div>
                <div className="stat-sub">direct reports</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Out today</div>
                <div className="stat-val" style={outToday > 0 ? { color: 'var(--color-danger-600)' } : undefined}>
                  {outToday}
                </div>
                <div className="stat-sub">on approved leave</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Upcoming leave</div>
                <div className="stat-val" style={pendingCount > 0 ? { color: 'var(--color-warning-600)' } : undefined}>
                  {pendingCount}
                </div>
                <div className="stat-sub">pending or approved</div>
              </div>
            </div>

            {/* member list */}
            {reports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div className="empty-state-title">No direct reports yet</div>
                <div className="empty-state-body">Your team members will appear here once they're assigned to you.</div>
              </div>
            ) : (
              <div className="list-card" style={{ marginBottom: 'var(--space-4)' }}>
                {reports.map((emp) => (
                  <MemberRow key={emp.id} employee={emp} allLeave={allLeave} today={today} />
                ))}
              </div>
            )}

            <Link className="tb-btn" to="/chat">Ask HR Agent about my team ↗</Link>
          </>
        )}
      </div>
    </div>
  )
}
