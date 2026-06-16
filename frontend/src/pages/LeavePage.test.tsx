import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LeavePageView } from './LeavePage'
import type { LeaveRequest } from '@/types/models'
import { formatDateRange, formatLeaveType } from '@/utils/leaveFormatting'

const myRequest: LeaveRequest = {
  id: 'leave-1',
  employee_id: 'employee-1',
  employee_name: 'Sam Staff',
  leave_type: 'annual',
  start_date: '2026-07-01',
  end_date: '2026-07-05',
  days_requested: 5,
  status: 'pending',
  reason: 'Family vacation',
}

const teamRequest: LeaveRequest = {
  id: 'leave-2',
  employee_id: 'employee-2',
  employee_name: 'Morgan Manager',
  leave_type: 'sick',
  start_date: '2026-08-10',
  end_date: '2026-08-11',
  days_requested: 2,
  status: 'pending',
  reason: 'Medical appointment',
}

const renderView = (overrides: Partial<Parameters<typeof LeavePageView>[0]>) =>
  renderToStaticMarkup(
    <LeavePageView
      actingRequestId={null}
      error={null}
      isLoading={false}
      isSubmitting={false}
      myRequests={[myRequest]}
      onApprove={vi.fn()}
      onReject={vi.fn()}
      onRetry={vi.fn()}
      onSubmitLeave={vi.fn()}
      submitError={null}
      teamRequests={[teamRequest]}
      {...overrides}
    />,
  )

describe('LeavePageView', () => {
  it('formats leave types and date ranges for display', () => {
    expect(formatLeaveType('annual')).toBe('Annual leave')
    expect(formatDateRange('2026-07-01', '2026-07-05')).toBe(
      'Jul 1, 2026 - Jul 5, 2026',
    )
  })

  it('renders personal and team leave request data', () => {
    const markup = renderView({})

    expect(markup).toContain('Leave management')
    expect(markup).toContain('Annual leave')
    expect(markup).toContain('Jul 1, 2026 - Jul 5, 2026')
    expect(markup).toContain('Sick leave')
    expect(markup).toContain('Morgan Manager')
    expect(markup).toContain('Approve')
    expect(markup).toContain('Reject')
  })

  it('renders empty state when there are no requests', () => {
    const markup = renderView({ myRequests: [], teamRequests: [] })

    expect(markup).toContain('No requests')
  })

  it('renders loading and error states', () => {
    expect(renderView({ isLoading: true })).toContain(
      'Loading leave requests...',
    )
    expect(renderView({ error: 'Network error' })).toContain('Network error')
  })
})
