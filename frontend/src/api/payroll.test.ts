import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { client } = vi.hoisted(() => ({
  client: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('./client', () => ({ default: client }))

import { payrollApi } from './payroll'

describe('payrollApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches own payroll records', async () => {
    const records = [{ id: 'pr-1', gross_salary: 5000 }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: records })

    await expect(payrollApi.getMyPayroll()).resolves.toBe(records)
    expect(client.get).toHaveBeenCalledWith('/api/payroll/mine')
  })

  it('fetches payroll for a specific employee by id', async () => {
    const records = [{ id: 'pr-2', gross_salary: 7500 }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: records })

    await expect(payrollApi.getEmployeePayroll('emp-99')).resolves.toBe(records)
    expect(client.get).toHaveBeenCalledWith('/api/payroll/employee/emp-99')
  })
})
