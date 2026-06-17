import { useEffect, useState } from 'react'
import { employeesApi } from '@/api/employees'
import { leaveApi } from '@/api/leave'
import type { Employee, LeaveRequest } from '@/types/models'

// ── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function tenure(startDate: string | null) {
  if (!startDate) return null
  const start = new Date(startDate)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (months < 1) return 'Less than a month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem === 0
    ? `${years} year${years === 1 ? '' : 's'}`
    : `${years} yr ${rem} mo`
}

function leaveStats(requests: LeaveRequest[]) {
  const year = new Date().getFullYear()
  const thisYear = requests.filter((r) => new Date(r.start_date).getFullYear() === year)
  const approved = thisYear.filter((r) => r.status === 'approved')
  const pending = thisYear.filter((r) => r.status === 'pending')
  const usedDays = approved
    .filter((r) => r.leave_type === 'annual')
    .reduce((s, r) => s + r.days_requested, 0)
  return { approved: approved.length, pending: pending.length, usedDays, remaining: Math.max(0, 20 - usedDays) }
}

// ── profile stat card ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="prof-info-row">
      <span className="prof-info-label">{label}</span>
      <span className="prof-info-value">{value}</span>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      employeesApi.getMe(),
      leaveApi.getMyLeaveRequests(),
    ]).then(([empRes, leaveRes]) => {
      if (empRes.status === 'fulfilled') setEmployee(empRes.value)
      else setError('Could not load profile.')
      if (leaveRes.status === 'fulfilled') setRequests(leaveRes.value)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="pol-page">
        <div className="page-topbar"><span className="page-topbar-title">My profile</span></div>
        <div className="pp" style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Loading…</div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="pol-page">
        <div className="page-topbar"><span className="page-topbar-title">My profile</span></div>
        <div className="pp"><div className="toast toast-error">{error ?? 'Profile not found.'}</div></div>
      </div>
    )
  }

  const stats = leaveStats(requests)
  const ten = tenure(employee.start_date)

  return (
    <div className="pol-page">
      <div className="page-topbar">
        <span className="page-topbar-title">My profile</span>
      </div>

      <div className="pp">
        {/* avatar + name header */}
        <div className="prof-hero">
          <div className="prof-avatar">{initials(employee.full_name)}</div>
          <div>
            <div className="prof-name">{employee.full_name}</div>
            <div className="prof-role">
              {[employee.role, employee.department].filter(Boolean).join(' · ')}
            </div>
            {ten && <div className="prof-tenure">{ten} at the company</div>}
          </div>
        </div>

        {/* details card */}
        <div className="list-card prof-details">
          <InfoRow label="Email" value={employee.email} />
          <InfoRow label="Role" value={employee.role ?? '—'} />
          <InfoRow label="Department" value={employee.department ?? '—'} />
          <InfoRow label="Manager" value={employee.manager_name ?? '—'} />
          <InfoRow label="Start date" value={formatDate(employee.start_date)} />
        </div>

        {/* leave summary */}
        <div className="sec-title" style={{ marginTop: 20 }}>Leave this year</div>
        <div className="prof-leave-stats">
          <div className="prof-leave-stat">
            <div className="prof-leave-val">{stats.remaining}</div>
            <div className="prof-leave-lbl">Annual days left</div>
          </div>
          <div className="prof-leave-stat">
            <div className="prof-leave-val">{stats.usedDays}</div>
            <div className="prof-leave-lbl">Annual days used</div>
          </div>
          <div className="prof-leave-stat">
            <div className="prof-leave-val">{stats.pending}</div>
            <div className="prof-leave-lbl">Pending requests</div>
          </div>
          <div className="prof-leave-stat">
            <div className="prof-leave-val">{stats.approved}</div>
            <div className="prof-leave-lbl">Approved this year</div>
          </div>
        </div>
      </div>
    </div>
  )
}
