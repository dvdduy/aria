export interface User {
  id: string
  email: string
  is_admin: boolean
}

export interface Employee {
  id: string
  email: string
  full_name: string
  department: string | null
  role: string | null
  manager_id: string | null
  is_active: boolean
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type LeaveType   = 'annual' | 'sick' | 'parental' | 'unpaid'

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_requested: number
  status: LeaveStatus
  reason: string | null
  created_at: string
}

export interface HRPolicy {
  id: string
  title: string
  category: string
  content: string
  version: string
  effective_date: string | null
}

export interface PayrollRecord {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  gross_salary: number
  net_salary: number
  currency: string
}
