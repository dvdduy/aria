import client from './client'
import type { LeaveRequest, LeaveType } from '@/types/models'

export interface RejectLeaveRequestPayload {
  rejection_reason: string
}

export interface SubmitLeaveRequestPayload {
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason?: string
}

export const leaveApi = {
  async getMyLeaveRequests() {
    const { data } = await client.get<LeaveRequest[]>('/api/leave/mine')
    return data
  },

  async getPendingTeamLeaveRequests() {
    const { data } = await client.get<LeaveRequest[]>('/api/leave/team/pending')
    return data
  },

  async getAllTeamLeaveRequests() {
    const { data } = await client.get<LeaveRequest[]>('/api/leave/team/all')
    return data
  },

  async approveLeaveRequest(requestId: string) {
    const { data } = await client.post<LeaveRequest>(
      `/api/leave/${requestId}/approve`,
    )
    return data
  },

  async rejectLeaveRequest(
    requestId: string,
    payload: RejectLeaveRequestPayload,
  ) {
    const { data } = await client.post<LeaveRequest>(
      `/api/leave/${requestId}/reject`,
      payload,
    )
    return data
  },

  async submitLeaveRequest(payload: SubmitLeaveRequestPayload) {
    const { data } = await client.post<LeaveRequest>('/api/leave/mine', payload)
    return data
  },
}
