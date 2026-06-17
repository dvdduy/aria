import { useEffect, useState } from 'react'
import { payrollApi } from '@/api/payroll'
import type { PayrollRecord } from '@/types/models'

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
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    payrollApi.getMyPayroll()
      .then(setRecords)
      .catch(() => setError('Failed to load payroll records.'))
      .finally(() => setIsLoading(false))
  }, [])

  const latest = records[0] ?? null
  const history = records.slice(1)

  return (
    <div className="lp">
      <div className="page-topbar">
        <span className="page-topbar-title">Payroll</span>
      </div>

      {isLoading && (
        <div className="lt-empty">Loading payroll records…</div>
      )}

      {error && (
        <div className="lt-empty" style={{ color: 'var(--color-danger-600)' }}>{error}</div>
      )}

      {!isLoading && !error && records.length === 0 && (
        <div className="lt-empty">No payroll records found.</div>
      )}

      {!isLoading && !error && latest && (
        <>
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
                  <div className="lt-hc">Currency</div>
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
                      <div className="lt-c">{r.currency}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
