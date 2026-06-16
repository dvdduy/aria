import type { LeaveType } from '@/types/models'

const leaveTypeLabels: Record<LeaveType, string> = {
  annual: 'Annual leave',
  parental: 'Parental leave',
  sick: 'Sick leave',
  unpaid: 'Unpaid leave',
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatDateRange(startDate: string, endDate: string) {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

export function formatLeaveType(type: LeaveType) {
  return leaveTypeLabels[type]
}
