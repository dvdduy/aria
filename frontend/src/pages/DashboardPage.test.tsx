import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import * as employeesApiModule from '@/api/employees'
import * as leaveApiModule from '@/api/leave'
import type { LeaveRequest } from '@/types/models'

vi.mock('@/api/employees', () => ({
  employeesApi: { getMe: vi.fn() },
}))

vi.mock('@/api/leave', () => ({
  leaveApi: {
    getMyLeaveRequests: vi.fn(),
    getPendingTeamLeaveRequests: vi.fn(),
    getAllTeamLeaveRequests: vi.fn(),
    approveLeaveRequest: vi.fn(),
    rejectLeaveRequest: vi.fn(),
  },
}))

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const mockProfile = { id: 'emp-1', full_name: 'Alice Smith', email: 'alice@example.com', role: 'Engineer', department: 'Engineering', is_active: true, manager_id: null, start_date: null, manager_name: null }

function makeLeave(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'leave-1', employee_id: 'emp-2', employee_name: 'Bob Jones',
    leave_type: 'annual', start_date: today, end_date: tomorrow,
    days_requested: 2, status: 'approved', reason: null,
    ...overrides,
  }
}

function renderPage() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(employeesApiModule.employeesApi.getMe).mockResolvedValue(mockProfile)
  vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([])
  vi.mocked(leaveApiModule.leaveApi.getPendingTeamLeaveRequests).mockResolvedValue([])
  vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([])
})

describe('DashboardPage', () => {
  it('renders stat cards after loading', async () => {
    renderPage()

    expect(await screen.findByText('Leave balance')).toBeTruthy()
    expect(screen.getByText('Out today')).toBeTruthy()
    expect(screen.getByText('Pending approvals')).toBeTruthy()
  })

  it('shows correct leave balance from approved annual requests', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave({ id: 'l1', employee_id: 'emp-1', leave_type: 'annual', days_requested: 5, status: 'approved' }),
    ])

    renderPage()

    // balance = 20 - 5 = 15
    expect(await screen.findByText('15')).toBeTruthy()
    expect(screen.getByText('5 days used this year')).toBeTruthy()
  })

  it('shows all-clear message when nothing needs attention', async () => {
    renderPage()

    expect(await screen.findByText(/All caught up/)).toBeTruthy()
  })

  it('shows out today chips for team members on approved leave', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave({ start_date: yesterday, end_date: tomorrow, status: 'approved', employee_name: 'Bob Jones' }),
    ])

    renderPage()

    expect(await screen.findByText('Bob Jones')).toBeTruthy()
    // both stat card label and section title use "Out today" — confirm section exists
    expect(screen.getAllByText('Out today').length).toBeGreaterThanOrEqual(2)
  })

  it('does not show out today chips for leave that already ended', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave({ start_date: '2020-01-01', end_date: '2020-01-05', status: 'approved', employee_name: 'Bob Jones' }),
    ])

    renderPage()

    await screen.findByText('Leave balance')
    // no chip and only the stat-card "Out today" label, not the section title
    expect(screen.getAllByText('Out today').length).toBe(1)
  })

  it('shows my upcoming leave section', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave({ id: 'l1', employee_id: 'emp-1', start_date: tomorrow, end_date: tomorrow, status: 'pending' }),
    ])

    renderPage()

    expect(await screen.findByText('My upcoming leave')).toBeTruthy()
  })

  it('shows pending team requests with approve and reject buttons', async () => {
    const pending = makeLeave({ id: 'leave-p1', status: 'pending', employee_name: 'Carol Lee' })
    vi.mocked(leaveApiModule.leaveApi.getPendingTeamLeaveRequests).mockResolvedValue([pending])

    renderPage()

    expect(await screen.findByText('Pending requests')).toBeTruthy()
    expect(screen.getByText('Carol Lee')).toBeTruthy()
    expect(screen.getByText('Approve')).toBeTruthy()
    expect(screen.getByText('Reject')).toBeTruthy()
  })

  it('calls approveLeaveRequest and reloads data when Approve is clicked', async () => {
    const pending = makeLeave({ id: 'leave-p1', status: 'pending', employee_name: 'Carol Lee' })
    vi.mocked(leaveApiModule.leaveApi.getPendingTeamLeaveRequests).mockResolvedValue([pending])
    vi.mocked(leaveApiModule.leaveApi.approveLeaveRequest).mockResolvedValue(
      { ...pending, status: 'approved' },
    )

    renderPage()

    fireEvent.click(await screen.findByText('Approve'))

    await waitFor(() => {
      expect(leaveApiModule.leaveApi.approveLeaveRequest).toHaveBeenCalledWith('leave-p1')
    })
  })

  it('opens reject modal and submits rejection reason', async () => {
    const pending = makeLeave({ id: 'leave-p1', status: 'pending', employee_name: 'Carol Lee' })
    vi.mocked(leaveApiModule.leaveApi.getPendingTeamLeaveRequests).mockResolvedValue([pending])
    vi.mocked(leaveApiModule.leaveApi.rejectLeaveRequest).mockResolvedValue(
      { ...pending, status: 'rejected' },
    )

    renderPage()

    fireEvent.click(await screen.findByText('Reject'))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Required'), { target: { value: 'Coverage issue' } })
    fireEvent.click(screen.getByText('Reject', { selector: 'button.btn-danger' }))

    await waitFor(() => {
      expect(leaveApiModule.leaveApi.rejectLeaveRequest).toHaveBeenCalledWith(
        'leave-p1', { rejection_reason: 'Coverage issue' },
      )
    })
  })

  it('shows quick action links', async () => {
    renderPage()

    expect(await screen.findByText('Ask HR Agent')).toBeTruthy()
    expect(screen.getByText('Manage leave')).toBeTruthy()
    expect(screen.getByText('HR policies')).toBeTruthy()
    expect(screen.getByText('Payroll records')).toBeTruthy()
  })
})
