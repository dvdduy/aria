import client from './client'
import type { PayrollRecord } from '@/types/models'

export const payrollApi = {
  async getMyPayroll() {
    const { data } = await client.get<PayrollRecord[]>('/api/payroll/mine')
    return data
  },

  async getEmployeePayroll(employeeId: string) {
    const { data } = await client.get<PayrollRecord[]>(`/api/payroll/employee/${employeeId}`)
    return data
  },
}
