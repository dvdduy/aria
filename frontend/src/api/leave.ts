import client from './client'
import type { LeaveRequest } from '@/types/models'

export interface RejectLeaveRequestPayload {
  rejection_reason: string
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
}
