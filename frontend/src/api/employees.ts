import client from './client'
import type { Employee } from '@/types/models'

export interface EmployeeCreateBody {
  full_name: string
  email: string
  role: string | null
  department: string | null
  manager_id: string | null
  start_date: string | null
  temp_password: string
}

export interface EmployeeUpdateBody {
  full_name: string
  role: string | null
  department: string | null
  manager_id: string | null
  start_date: string | null
}

export const employeesApi = {
  async getMe() {
    const { data } = await client.get<Employee>('/api/employees/me')
    return data
  },

  async getDirectReports() {
    const { data } = await client.get<Employee[]>('/api/employees/direct-reports')
    return data
  },

  async listAll() {
    const { data } = await client.get<Employee[]>('/api/employees')
    return data
  },

  async createEmployee(body: EmployeeCreateBody) {
    const { data } = await client.post<Employee>('/api/employees', body)
    return data
  },

  async updateEmployee(id: string, body: EmployeeUpdateBody) {
    const { data } = await client.put<Employee>(`/api/employees/${id}`, body)
    return data
  },

  async deactivateEmployee(id: string) {
    const { data } = await client.post<Employee>(`/api/employees/${id}/deactivate`)
    return data
  },

  async reactivateEmployee(id: string) {
    const { data } = await client.post<Employee>(`/api/employees/${id}/reactivate`)
    return data
  },
}
