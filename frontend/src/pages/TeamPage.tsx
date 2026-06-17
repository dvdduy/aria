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

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatLeaveDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  })
}

export default function TeamPage() {
  const [reports, setReports] = useState<Employee[]>([])
  const [pendingLeave, setPendingLeave] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      employeesApi.getDirectReports(),
      leaveApi.getPendingTeamLeaveRequests(),
    ])
      .then(([emps, leave]) => {
        setReports(emps)
        setPendingLeave(leave)
      })
      .catch(() => setError('Failed to load team information.'))
      .finally(() => setIsLoading(false))
  }, [])

  const leaveByEmployee = new Map<string, LeaveRequest>(
    pendingLeave.map((l) => [l.employee_id, l]),
  )

  return (
    <div className="lp">
      <div className="ph">
        <span className="ptitle">Team overview</span>
      </div>

      {isLoading && <div className="lt-empty">Loading…</div>}
      {error && (
        <div className="lt-empty" style={{ color: 'var(--color-danger-600)' }}>
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="teamp">
          <div className="sec-title">
            Your direct reports · {reports.length} member{reports.length !== 1 ? 's' : ''}
          </div>

          {reports.length === 0 ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', padding: '8px 0' }}>
              No direct reports.
            </div>
          ) : (
            <div className="list-card">
              {reports.map((emp, i) => {
                const colors = AVATAR_COLORS[i % AVATAR_COLORS.length]
                const leave = leaveByEmployee.get(emp.id)
                return (
                  <div className="list-row" key={emp.id}>
                    <div className="av" style={{ background: colors.bg, color: colors.color }}>
                      {getInitials(emp.full_name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="lname">{emp.full_name}</div>
                      <div className="lmeta">{emp.role ?? emp.department ?? '—'}</div>
                    </div>
                    {leave ? (
                      <span className="badge-pend">
                        On leave {formatLeaveDate(leave.start_date)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        Active
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <Link className="tb-btn" to="/chat">
            Ask HR Agent about my team ↗
          </Link>
        </div>
      )}
    </div>
  )
}
