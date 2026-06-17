import client from './client'
import type { Employee } from '@/types/models'

export const employeesApi = {
  async getMe() {
    const { data } = await client.get<Employee>('/api/employees/me')
    return data
  },

  async getDirectReports() {
    const { data } = await client.get<Employee[]>('/api/employees/direct-reports')
    return data
  },
}
