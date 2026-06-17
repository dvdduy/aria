import { useEffect, useMemo, useState } from 'react'
import { leaveApi } from '@/api/leave'
import { employeesApi } from '@/api/employees'
import type { LeaveRequest } from '@/types/models'

// ── helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'var(--color-info-50)',  color: 'var(--color-info-800)',  border: 'var(--color-info-200)'  },
  { bg: 'var(--color-teal-50)', color: 'var(--color-teal-800)',  border: 'var(--color-border-default)' },
  { bg: 'var(--color-pink-50)', color: 'var(--color-pink-800)',  border: 'var(--color-border-default)' },
  { bg: 'var(--color-green-50)',color: 'var(--color-green-800)', border: 'var(--color-border-default)' },
  { bg: 'var(--color-brand-50)',color: 'var(--color-brand-800)', border: 'var(--color-brand-200)' },
]

function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0]
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function startDow(year: number, month: number) {
  // 0=Mon … 6=Sun
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function overlaps(req: LeaveRequest, dateStr: string) {
  return req.start_date <= dateStr && req.end_date >= dateStr
}

function isToday(year: number, month: number, day: number) {
  const t = new Date()
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
}

function isWeekend(dow: number) {
  return dow === 5 || dow === 6 // Sat, Sun
}

// ── leave chip ────────────────────────────────────────────────────────────────

function LeaveChip({ name, pending }: { name: string; pending: boolean }) {
  const col = colorFor(name)
  return (
    <div
      className={`cal-chip${pending ? ' cal-chip-pending' : ''}`}
      style={{ background: col.bg, color: col.color, borderColor: col.border }}
      title={`${name}${pending ? ' (pending)' : ''}`}
    >
      <span className="cal-chip-av" style={{ background: col.color }}>{initials(name)}</span>
      <span className="cal-chip-name">{firstName(name)}</span>
    </div>
  )
}

// ── day cell ─────────────────────────────────────────────────────────────────

function DayCell({ day, offset, year, month, requests }: {
  day: number | null
  offset?: number
  year: number
  month: number
  requests: LeaveRequest[]
}) {
  if (day === null) return <div className="cal-cell cal-cell-empty" />

  const dateStr = toDateStr(year, month, day)
  const dow = offset !== undefined ? (offset + day - 1) % 7 : 0
  const dayRequests = requests.filter(
    (r) => overlaps(r, dateStr) && (r.status === 'approved' || r.status === 'pending'),
  )
  const today = isToday(year, month, day)
  const weekend = isWeekend(dow)

  return (
    <div className={`cal-cell${today ? ' cal-cell-today' : ''}${weekend ? ' cal-cell-weekend' : ''}`}>
      <span className={`cal-day-num${today ? ' cal-day-num-today' : ''}`}>{day}</span>
      <div className="cal-chips">
        {dayRequests.map((r) => (
          <LeaveChip
            key={r.id}
            name={r.employee_name ?? 'Unknown'}
            pending={r.status === 'pending'}
          />
        ))}
      </div>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [, setMyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      leaveApi.getMyLeaveRequests(),
      leaveApi.getAllTeamLeaveRequests(),
      employeesApi.getMe(),
    ]).then(([myRes, teamRes, meRes]) => {
      const seen = new Set<string>()
      const merged: LeaveRequest[] = []

      const addAll = (items: LeaveRequest[], fallbackName?: string) => {
        for (const r of items) {
          if (!seen.has(r.id)) {
            seen.add(r.id)
            merged.push(fallbackName && !r.employee_name ? { ...r, employee_name: fallbackName } : r)
          }
        }
      }

      const name = meRes.status === 'fulfilled' ? meRes.value.full_name : null
      setMyName(name)

      if (myRes.status === 'fulfilled') addAll(myRes.value, name ?? undefined)
      if (teamRes.status === 'fulfilled') addAll(teamRes.value)

      setRequests(merged)
      if (myRes.status === 'rejected' && teamRes.status === 'rejected') {
        setError('Could not load leave data.')
      }
    }).finally(() => setLoading(false))
  }, [])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const totalDays = daysInMonth(year, month)
  const offset = startDow(year, month)

  // Build grid: leading blanks + days
  const cells = useMemo(() => {
    const out: Array<{ day: number | null; dow: number }> = []
    for (let i = 0; i < offset; i++) out.push({ day: null, dow: i })
    for (let d = 1; d <= totalDays; d++) out.push({ day: d, dow: (offset + d - 1) % 7 })
    // pad to complete last row
    while (out.length % 7 !== 0) out.push({ day: null, dow: out.length % 7 })
    return out
  }, [year, month, offset, totalDays])

  // People on leave this month (for legend)
  const monthStart = toDateStr(year, month, 1)
  const monthEnd = toDateStr(year, month, totalDays)
  const activeThisMonth = useMemo(() => {
    const seen = new Set<string>()
    return requests.filter((r) => {
      if (r.status !== 'approved' && r.status !== 'pending') return false
      if (r.end_date < monthStart || r.start_date > monthEnd) return false
      const key = r.employee_name ?? r.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [requests, monthStart, monthEnd])

  return (
    <div className="pol-page">
      <div className="page-topbar">
        <span className="page-topbar-title">Leave calendar</span>
        <div className="cal-month-nav">
          <button className="btn-icon" onClick={prevMonth} type="button" aria-label="Previous month">
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="cal-month-label">{MONTHS[month]} {year}</span>
          <button className="btn-icon" onClick={nextMonth} type="button" aria-label="Next month">
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="cal-body">
        {error && <div className="toast toast-error" style={{ margin: '12px 16px 0' }}>{error}</div>}

        {loading ? (
          <div className="cal-loading">Loading…</div>
        ) : (
          <>
            {/* legend */}
            {activeThisMonth.length > 0 && (
              <div className="cal-legend">
                {activeThisMonth.map((r) => {
                  const name = r.employee_name ?? 'Unknown'
                  const col = colorFor(name)
                  return (
                    <div key={r.id} className="cal-legend-item">
                      <div className="cal-legend-dot" style={{ background: col.bg, color: col.color, borderColor: col.border }}>
                        {initials(name)}
                      </div>
                      <span>{name}</span>
                      {r.status === 'pending' && <span className="cal-legend-pend">pending</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* grid */}
            <div className="cal-grid">
              {DOW.map((d) => (
                <div className="cal-dow" key={d}>{d}</div>
              ))}
              {cells.map((c, i) => (
                <DayCell
                  key={i}
                  day={c.day}
                  offset={offset}
                  year={year}
                  month={month}
                  requests={requests}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
