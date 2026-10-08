import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfilePage from './ProfilePage'
import * as employeesApiModule from '@/api/employees'
import * as leaveApiModule from '@/api/leave'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'

vi.mock('@/api/employees', () => ({
  employeesApi: { getMe: vi.fn() },
}))

vi.mock('@/api/leave', () => ({
  leaveApi: { getMyLeaveRequests: vi.fn() },
}))

const thisYear = new Date().getFullYear()

const mockEmployee = {
  id: 'emp-1',
  full_name: 'Alice Smith',
  email: 'alice@example.com',
  role: 'Software Engineer',
  department: 'Engineering',
  is_active: true,
  manager_id: 'emp-2',
  manager_name: 'Bob Manager',
  start_date: '2022-01-15',
}

function makeLeave(id: string, type: LeaveType, status: LeaveStatus, days: number): LeaveRequest {
  return {
    id,
    employee_id: 'emp-1',
    employee_name: 'Alice Smith',
    leave_type: type,
    start_date: `${thisYear}-03-01`,
    end_date: `${thisYear}-03-05`,
    days_requested: days,
    status,
    reason: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(employeesApiModule.employeesApi.getMe).mockResolvedValue(mockEmployee)
  vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([])
})

describe('ProfilePage', () => {
  it('shows loading state before data arrives', () => {
    vi.mocked(employeesApiModule.employeesApi.getMe).mockReturnValue(new Promise(() => {}))

    render(<ProfilePage />)

    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('renders employee full name after loading', async () => {
    render(<ProfilePage />)

    expect(await screen.findByText('Alice Smith')).toBeTruthy()
  })

  it('shows correct initials in avatar', async () => {
    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('AS')).toBeTruthy()
  })

  it('shows role and department in hero section', async () => {
    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('Software Engineer · Engineering')).toBeTruthy()
  })

  it('shows tenure text based on start date', async () => {
    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText(/at the company/)).toBeTruthy()
  })

  it('shows details card with email, role, department, manager, start date', async () => {
    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('alice@example.com')).toBeTruthy()
    expect(screen.getAllByText('Software Engineer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Engineering').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Bob Manager')).toBeTruthy()
  })

  it('shows "—" for manager when not set', async () => {
    vi.mocked(employeesApiModule.employeesApi.getMe).mockResolvedValue({
      ...mockEmployee,
      manager_name: null,
    })

    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('does not show tenure when start_date is null', async () => {
    vi.mocked(employeesApiModule.employeesApi.getMe).mockResolvedValue({
      ...mockEmployee,
      start_date: null,
    })

    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.queryByText(/at the company/)).toBeNull()
  })

  it('shows correct leave balance — 20 minus used annual days', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave('l1', 'annual', 'approved', 5),
    ])

    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('15')).toBeTruthy()  // remaining = 20 - 5
    expect(screen.getByText('5')).toBeTruthy()   // used
    expect(screen.getByText('Annual days left')).toBeTruthy()
    expect(screen.getByText('Annual days used')).toBeTruthy()
  })

  it('only counts annual leave toward the balance (not sick/parental)', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave('l1', 'sick', 'approved', 3),
      makeLeave('l2', 'annual', 'approved', 5),
    ])

    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    // sick leave shouldn't reduce annual balance
    expect(screen.getByText('15')).toBeTruthy()  // 20 - 5 = 15
  })

  it('shows pending request count', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave('l1', 'annual', 'pending', 3),
      makeLeave('l2', 'annual', 'pending', 2),
    ])

    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('Pending requests')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('shows approved count for the year', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave('l1', 'annual', 'approved', 5),
      makeLeave('l2', 'sick', 'approved', 2),
    ])

    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('Approved this year')).toBeTruthy()
    // 2 approved requests total
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('shows zero leave stats when no requests exist', async () => {
    render(<ProfilePage />)

    await screen.findByText('Alice Smith')
    expect(screen.getByText('20')).toBeTruthy()  // full entitlement remaining
    expect(screen.getByText('Annual days left')).toBeTruthy()
  })

  it('shows error state when profile fetch fails', async () => {
    vi.mocked(employeesApiModule.employeesApi.getMe).mockRejectedValue(new Error())

    render(<ProfilePage />)

    expect(await screen.findByText('Could not load profile.')).toBeTruthy()
  })
})
