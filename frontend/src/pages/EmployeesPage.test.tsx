import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployeesPage from './EmployeesPage'
import * as employeesApiModule from '@/api/employees'

vi.mock('@/api/employees', () => ({
  employeesApi: {
    listAll: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    deactivateEmployee: vi.fn(),
    reactivateEmployee: vi.fn(),
  },
}))

const alice = { id: 'emp-1', email: 'alice@example.com', full_name: 'Alice Smith', role: 'Engineer', department: 'Engineering', is_active: true, manager_id: null, start_date: null, manager_name: null }
const bob   = { id: 'emp-2', email: 'bob@example.com',   full_name: 'Bob Jones',   role: 'Designer',  department: 'Design',      is_active: true, manager_id: null, start_date: null, manager_name: null }
const carol = { id: 'emp-3', email: 'carol@example.com', full_name: 'Carol Lee',   role: 'Manager',   department: 'Engineering', is_active: false, manager_id: null, start_date: null, manager_name: null }

function renderPage() {
  return render(<MemoryRouter><EmployeesPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(employeesApiModule.employeesApi.listAll).mockResolvedValue([alice, bob, carol])
})

describe('EmployeesPage', () => {
  it('renders employee list with active/inactive counts', async () => {
    renderPage()

    expect(await screen.findByText('Alice Smith')).toBeTruthy()
    expect(screen.getByText('Bob Jones')).toBeTruthy()
    expect(screen.getByText('Carol Lee')).toBeTruthy()
    expect(screen.getByText(/2 active/)).toBeTruthy()
    expect(screen.getByText(/1 inactive/)).toBeTruthy()
  })

  it('shows inactive badge on deactivated employees', async () => {
    renderPage()

    await screen.findByText('Carol Lee')
    expect(screen.getByText('Inactive')).toBeTruthy()
  })

  it('filters employees by search query', async () => {
    renderPage()

    await screen.findByText('Alice Smith')
    const input = screen.getByPlaceholderText('Search employees…')
    fireEvent.change(input, { target: { value: 'design' } })

    expect(screen.queryByText('Alice Smith')).toBeNull()
    expect(screen.getByText('Bob Jones')).toBeTruthy()
  })

  it('shows contextual empty state when search has no matches', async () => {
    renderPage()

    await screen.findByText('Alice Smith')
    fireEvent.change(screen.getByPlaceholderText('Search employees…'), { target: { value: 'zzznomatch' } })

    expect(screen.getByText(/No employees match/)).toBeTruthy()
    expect(screen.getByText('Clear search')).toBeTruthy()
  })

  it('clears search when Clear search is clicked', async () => {
    renderPage()

    await screen.findByText('Alice Smith')
    fireEvent.change(screen.getByPlaceholderText('Search employees…'), { target: { value: 'zzznomatch' } })
    fireEvent.click(screen.getByText('Clear search'))

    expect(screen.getByText('Alice Smith')).toBeTruthy()
  })

  it('shows error state when list fetch fails', async () => {
    vi.mocked(employeesApiModule.employeesApi.listAll).mockRejectedValue(new Error())
    renderPage()

    expect(await screen.findByText('Could not load employees.')).toBeTruthy()
  })

  it('opens new employee modal when + New employee is clicked', async () => {
    renderPage()

    await screen.findByText('Alice Smith')
    fireEvent.click(screen.getByText('+ New employee'))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('New employee')).toBeTruthy()
    expect(screen.getByPlaceholderText('jane@company.com')).toBeTruthy()
  })

  it('opens edit modal pre-filled with employee data', async () => {
    renderPage()

    await screen.findByText('Alice Smith')
    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Edit employee')).toBeTruthy()
    expect((screen.getByPlaceholderText('Jane Smith') as HTMLInputElement).value).toBe('Alice Smith')
  })

  it('closes modal when Cancel is clicked', async () => {
    renderPage()

    await screen.findByText('Alice Smith')
    fireEvent.click(screen.getByText('+ New employee'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('creates employee and reloads list on form submit', async () => {
    vi.mocked(employeesApiModule.employeesApi.createEmployee).mockResolvedValue(alice)
    renderPage()

    await screen.findByText('Alice Smith')
    fireEvent.click(screen.getByText('+ New employee'))

    fireEvent.change(screen.getByPlaceholderText('Jane Smith'), { target: { value: 'New Person' } })
    fireEvent.change(screen.getByPlaceholderText('jane@company.com'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Employee will use this to log in'), { target: { value: 'tmppass123' } })
    fireEvent.click(screen.getByText('Create employee'))

    await waitFor(() => {
      expect(employeesApiModule.employeesApi.createEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: 'New Person', email: 'new@example.com', temp_password: 'tmppass123' }),
      )
    })
  })
})
