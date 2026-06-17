import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { employeesApi } from '@/api/employees'
import { payrollApi } from '@/api/payroll'
import type { Employee, PayrollRecord } from '@/types/models'

function isAdmin(): boolean {
  try {
    const token = sessionStorage.getItem('aria_token') ?? ''
    const claims = JSON.parse(atob(token.split('.')[1])) as { is_admin?: boolean }
    return claims.is_admin === true
  } catch {
    return false
  }
}

function formatPeriod(start: string): string {
  return new Date(start + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function SummaryCard({ record }: { record: PayrollRecord }) {
  const deductions = record.gross_salary - record.net_salary
  return (
    <div className="pr-summary">
      <div className="pr-summary-period">
        Latest payslip — {formatPeriod(record.period_start)}
      </div>
      <div className="pr-stats">
        <div className="pr-stat">
          <div className="pr-stat-label">Gross</div>
          <div className="pr-stat-value">{formatCurrency(record.gross_salary, record.currency)}</div>
        </div>
        <div className="pr-stat-divider" />
        <div className="pr-stat">
          <div className="pr-stat-label">Deductions</div>
          <div className="pr-stat-value pr-stat-deduction">−{formatCurrency(deductions, record.currency)}</div>
        </div>
        <div className="pr-stat-divider" />
        <div className="pr-stat">
          <div className="pr-stat-label">Net pay</div>
          <div className="pr-stat-value pr-stat-net">{formatCurrency(record.net_salary, record.currency)}</div>
        </div>
      </div>
    </div>
  )
}

export default function PayrollPage() {
  const admin = isAdmin()
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')

  useEffect(() => {
    if (admin) {
      employeesApi.listAll()
        .then((all) => setEmployees(all.filter((e) => e.is_active)))
        .catch(() => {})
    }
  }, [admin])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const fetch = selectedEmployeeId
      ? payrollApi.getEmployeePayroll(selectedEmployeeId)
      : payrollApi.getMyPayroll()
    fetch
      .then(setRecords)
      .catch(() => setError('Failed to load payroll records.'))
      .finally(() => setIsLoading(false))
  }, [selectedEmployeeId])

  const latest = records[0] ?? null
  const history = records.slice(1)
  const viewingEmployee = employees.find((e) => e.id === selectedEmployeeId)

  return (
    <div className="pol-page">
      <div className="page-topbar">
        <span className="page-topbar-title">Payroll</span>
        {admin && employees.length > 0 && (
          <select
            className="input"
            style={{ width: 'auto', minWidth: 180, fontSize: 'var(--text-sm)' }}
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="">My payroll</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="pp">
        {isLoading && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Loading…</div>
        )}

        {error && (
          <div className="toast toast-error">{error}</div>
        )}

        {!isLoading && !error && records.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
                <rect height="14" rx="2" width="20" x="2" y="5"/><line x1="2" x2="22" y1="10" y2="10"/>
              </svg>
            </div>
            <div className="empty-state-title">No payroll records yet</div>
            <div className="empty-state-body">
              {viewingEmployee
                ? `No payslips found for ${viewingEmployee.full_name}.`
                : 'Your payslips will appear here once payroll has been processed.'}
            </div>
          </div>
        )}

        {!isLoading && !error && latest && (
          <>
            {viewingEmployee && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
                Viewing payroll for {viewingEmployee.full_name}
              </div>
            )}
            <SummaryCard record={latest} />

            {history.length > 0 && (
              <div className="pr-history">
                <div className="pr-history-title">Pay history</div>
                <div className="ltable">
                  <div className="lt-head">
                    <div className="lt-hc" style={{ flex: 2 }}>Period</div>
                    <div className="lt-hc">Gross</div>
                    <div className="lt-hc">Deductions</div>
                    <div className="lt-hc">Net pay</div>
                  </div>
                  {history.map((r) => {
                    const deductions = r.gross_salary - r.net_salary
                    return (
                      <div className="lt-row" key={r.id}>
                        <div className="lt-c" style={{ flex: 2 }}>{formatPeriod(r.period_start)}</div>
                        <div className="lt-c">{formatCurrency(r.gross_salary, r.currency)}</div>
                        <div className="lt-c" style={{ color: 'var(--color-text-secondary)' }}>
                          −{formatCurrency(deductions, r.currency)}
                        </div>
                        <div className="lt-c" style={{ fontWeight: 'var(--weight-medium)' }}>
                          {formatCurrency(r.net_salary, r.currency)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <Link className="tb-btn" style={{ marginTop: 'var(--space-4)' }} to="/chat">
              Ask HR Agent about my payroll ↗
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
