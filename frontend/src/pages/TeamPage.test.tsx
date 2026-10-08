import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TeamPage from './TeamPage'
import * as employeesApiModule from '@/api/employees'
import * as leaveApiModule from '@/api/leave'
import type { LeaveRequest, LeaveStatus } from '@/types/models'

vi.mock('@/api/employees', () => ({
  employeesApi: { getDirectReports: vi.fn() },
}))

vi.mock('@/api/leave', () => ({
  leaveApi: { getAllTeamLeaveRequests: vi.fn() },
}))

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

function makeEmployee(id: string, name: string): ReturnType<typeof Object.assign> {
  return { id, full_name: name, email: `${id}@example.com`, role: 'Engineer', department: 'Eng', is_active: true, manager_id: null, start_date: null, manager_name: null }
}

function makeLeave(employeeId: string, status: LeaveStatus, start: string, end: string): LeaveRequest {
  return { id: `leave-${employeeId}`, employee_id: employeeId, employee_name: 'Test', leave_type: 'annual', start_date: start, end_date: end, days_requested: 1, status, reason: null }
}

function renderPage() {
  return render(<MemoryRouter><TeamPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([])
})

describe('TeamPage', () => {
  it('renders team member list after loading', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
      makeEmployee('emp-2', 'Bob Jones'),
    ])

    renderPage()

    expect(await screen.findByText('Alice Smith')).toBeTruthy()
    expect(screen.getByText('Bob Jones')).toBeTruthy()
  })

  it('shows correct team size stat', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
      makeEmployee('emp-2', 'Bob Jones'),
      makeEmployee('emp-3', 'Carol Lee'),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('direct reports')).toBeTruthy()
  })

  it('shows out-today count when members are on approved leave', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
      makeEmployee('emp-2', 'Bob Jones'),
    ])
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('emp-1', 'approved', yesterday, tomorrow),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    // stat card value for out today
    const statValues = screen.getAllByText('1')
    expect(statValues.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Out today" badge with return date for employee on approved leave now', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
    ])
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('emp-1', 'approved', yesterday, tomorrow),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    // stat-card label + badge both contain "Out today"
    expect(screen.getAllByText(/Out today/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/back/)).toBeTruthy()
  })

  it('shows "Leave from" badge for employee with upcoming approved leave', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
    ])
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('emp-1', 'approved', tomorrow, tomorrow),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    expect(screen.getByText(/Leave from/)).toBeTruthy()
  })

  it('shows "Leave from" badge for employee with pending request', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
    ])
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('emp-1', 'pending', tomorrow, tomorrow),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    expect(screen.getByText(/Leave from/)).toBeTruthy()
  })

  it('shows "Available" for employee with no leave', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    expect(screen.getByText('Available')).toBeTruthy()
  })

  it('prioritises active approved leave over upcoming leave', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
    ])
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('emp-1', 'approved', yesterday, tomorrow),   // active now
      makeLeave('emp-1', 'approved', tomorrow, tomorrow),    // upcoming
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    expect(screen.getAllByText(/Out today/).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/Leave from/)).toBeNull()
  })

  it('shows empty state when manager has no direct reports', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No direct reports yet')).toBeTruthy()
  })

  it('shows error state when fetch fails', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockRejectedValue(new Error())

    renderPage()

    expect(await screen.findByText('Failed to load team information.')).toBeTruthy()
  })

  it('shows link to chat', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      makeEmployee('emp-1', 'Alice Smith'),
    ])

    renderPage()

    await screen.findByText('Alice Smith')
    expect(screen.getByText(/Ask HR Agent about my team/)).toBeTruthy()
  })
})
