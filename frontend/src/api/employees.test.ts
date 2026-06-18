import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { client } = vi.hoisted(() => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

vi.mock('./client', () => ({ default: client }))

import { employeesApi } from './employees'

const mockEmployee = { id: 'emp-1', email: 'alice@example.com', full_name: 'Alice' }

describe('employeesApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches the current user employee profile', async () => {
    ;(client.get as Mock).mockResolvedValueOnce({ data: mockEmployee })

    await expect(employeesApi.getMe()).resolves.toBe(mockEmployee)
    expect(client.get).toHaveBeenCalledWith('/api/employees/me')
  })

  it('fetches direct reports', async () => {
    const reports = [mockEmployee]
    ;(client.get as Mock).mockResolvedValueOnce({ data: reports })

    await expect(employeesApi.getDirectReports()).resolves.toBe(reports)
    expect(client.get).toHaveBeenCalledWith('/api/employees/direct-reports')
  })

  it('lists all employees', async () => {
    const all = [mockEmployee]
    ;(client.get as Mock).mockResolvedValueOnce({ data: all })

    await expect(employeesApi.listAll()).resolves.toBe(all)
    expect(client.get).toHaveBeenCalledWith('/api/employees')
  })

  it('creates an employee with the supplied body', async () => {
    const body = {
      full_name: 'Bob', email: 'bob@example.com',
      role: 'Engineer', department: 'Eng',
      manager_id: null, start_date: null, temp_password: 'tmp123',
    }
    ;(client.post as Mock).mockResolvedValueOnce({ data: mockEmployee })

    await expect(employeesApi.createEmployee(body)).resolves.toBe(mockEmployee)
    expect(client.post).toHaveBeenCalledWith('/api/employees', body)
  })

  it('updates an employee by id', async () => {
    const body = { full_name: 'Alice B', role: null, department: null, manager_id: null, start_date: null }
    ;(client.put as Mock).mockResolvedValueOnce({ data: mockEmployee })

    await expect(employeesApi.updateEmployee('emp-1', body)).resolves.toBe(mockEmployee)
    expect(client.put).toHaveBeenCalledWith('/api/employees/emp-1', body)
  })

  it('deactivates an employee by id', async () => {
    ;(client.post as Mock).mockResolvedValueOnce({ data: mockEmployee })

    await expect(employeesApi.deactivateEmployee('emp-1')).resolves.toBe(mockEmployee)
    expect(client.post).toHaveBeenCalledWith('/api/employees/emp-1/deactivate')
  })

  it('reactivates an employee by id', async () => {
    ;(client.post as Mock).mockResolvedValueOnce({ data: mockEmployee })

    await expect(employeesApi.reactivateEmployee('emp-1')).resolves.toBe(mockEmployee)
    expect(client.post).toHaveBeenCalledWith('/api/employees/emp-1/reactivate')
  })
})
