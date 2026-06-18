import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarPage from './CalendarPage'
import * as leaveApiModule from '@/api/leave'
import * as employeesApiModule from '@/api/employees'

vi.mock('@/api/leave', () => ({
  leaveApi: {
    getMyLeaveRequests: vi.fn(),
    getAllTeamLeaveRequests: vi.fn(),
  },
}))

vi.mock('@/api/employees', () => ({
  employeesApi: { getMe: vi.fn() },
}))

const today = new Date()
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const currentMonthLabel = `${MONTHS[today.getMonth()]} ${today.getFullYear()}`

const todayStr = today.toISOString().slice(0, 10)

const mockMe = { id: 'emp-me', full_name: 'Sam Staff', email: 'sam@example.com', role: 'Engineer', department: 'Eng', is_active: true, manager_id: null, start_date: null, manager_name: null }

function makeLeave(id: string, name: string | null, status: string, start: string, end: string) {
  return { id, employee_id: 'emp-1', employee_name: name, leave_type: 'annual', start_date: start, end_date: end, days_requested: 1, status, reason: null }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([])
  vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([])
  vi.mocked(employeesApiModule.employeesApi.getMe).mockResolvedValue(mockMe)
})

describe('CalendarPage', () => {
  it('renders day-of-week headers', async () => {
    render(<CalendarPage />)

    expect(await screen.findByText('Mon')).toBeTruthy()
    expect(screen.getByText('Wed')).toBeTruthy()
    expect(screen.getByText('Sun')).toBeTruthy()
  })

  it('shows current month label on load', async () => {
    render(<CalendarPage />)

    expect(await screen.findByText(currentMonthLabel)).toBeTruthy()
  })

  it('shows leave chip for approved leave overlapping today', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('lv-1', 'Alice Smith', 'approved', todayStr, todayStr),
    ])

    render(<CalendarPage />)

    // chip div has title="Alice Smith"
    expect(await screen.findByTitle('Alice Smith')).toBeTruthy()
  })

  it('shows leave chip for pending leave overlapping today', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('lv-1', 'Bob Jones', 'pending', todayStr, todayStr),
    ])

    render(<CalendarPage />)

    expect(await screen.findByTitle('Bob Jones (pending)')).toBeTruthy()
  })

  it('does not show chip for rejected leave', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('lv-1', 'Carol Lee', 'rejected', todayStr, todayStr),
    ])

    render(<CalendarPage />)

    await screen.findByText('Mon')
    expect(screen.queryByTitle('Carol Lee')).toBeNull()
  })

  it('does not show chip for leave outside the current month', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('lv-1', 'Dave Kim', 'approved', '2020-01-01', '2020-01-05'),
    ])

    render(<CalendarPage />)

    await screen.findByText('Mon')
    expect(screen.queryByTitle('Dave Kim')).toBeNull()
  })

  it('uses own name from getMe for my leave requests with no employee_name', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([
      makeLeave('lv-me', null, 'approved', todayStr, todayStr),
    ])

    render(<CalendarPage />)

    // title uses getMe full_name "Sam Staff" as fallback
    expect(await screen.findByTitle('Sam Staff')).toBeTruthy()
  })

  it('deduplicates leave appearing in both my requests and team requests', async () => {
    const leave = makeLeave('lv-shared', 'Alice Smith', 'approved', todayStr, todayStr)
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockResolvedValue([leave])
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([leave])

    render(<CalendarPage />)

    // only one chip rendered (not two), and one legend entry
    expect(await screen.findByTitle('Alice Smith')).toBeTruthy()
    expect(screen.getAllByText('Alice Smith').length).toBe(1)
  })

  it('shows legend entry for person on leave this month', async () => {
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('lv-1', 'Maria Lopez', 'approved', todayStr, todayStr),
    ])

    render(<CalendarPage />)

    expect(await screen.findByText('Maria Lopez')).toBeTruthy()
  })

  it('navigates to next month and updates label', async () => {
    render(<CalendarPage />)

    await screen.findByText(currentMonthLabel)
    fireEvent.click(screen.getByLabelText('Next month'))

    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    expect(screen.getByText(`${MONTHS[next.getMonth()]} ${next.getFullYear()}`)).toBeTruthy()
  })

  it('navigates to previous month and updates label', async () => {
    render(<CalendarPage />)

    await screen.findByText(currentMonthLabel)
    fireEvent.click(screen.getByLabelText('Previous month'))

    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    expect(screen.getByText(`${MONTHS[prev.getMonth()]} ${prev.getFullYear()}`)).toBeTruthy()
  })

  it('Today button is disabled on the current month', async () => {
    render(<CalendarPage />)

    await screen.findByText(currentMonthLabel)
    const todayBtn = screen.getByRole('button', { name: 'Today' })
    expect((todayBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('Today button is enabled after navigating away and returns to current month', async () => {
    render(<CalendarPage />)

    await screen.findByText(currentMonthLabel)
    fireEvent.click(screen.getByLabelText('Next month'))

    const todayBtn = screen.getByRole('button', { name: 'Today' })
    expect((todayBtn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(todayBtn)
    expect(screen.getByText(currentMonthLabel)).toBeTruthy()
  })

  it('shows error when both leave fetches fail', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockRejectedValue(new Error())
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockRejectedValue(new Error())

    render(<CalendarPage />)

    expect(await screen.findByText('Could not load leave data.')).toBeTruthy()
  })

  it('renders calendar when only one fetch fails', async () => {
    vi.mocked(leaveApiModule.leaveApi.getMyLeaveRequests).mockRejectedValue(new Error())
    vi.mocked(leaveApiModule.leaveApi.getAllTeamLeaveRequests).mockResolvedValue([
      makeLeave('lv-1', 'Bob Jones', 'approved', todayStr, todayStr),
    ])

    render(<CalendarPage />)

    // no error shown, team data still renders
    expect(await screen.findByTitle('Bob Jones')).toBeTruthy()
    expect(screen.queryByText('Could not load leave data.')).toBeNull()
  })
})
