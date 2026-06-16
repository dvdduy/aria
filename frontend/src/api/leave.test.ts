import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { client } = vi.hoisted(() => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('./client', () => ({
  default: client,
}))

import { leaveApi } from './leave'

describe('leaveApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the authenticated user leave requests', async () => {
    const requests = [{ id: 'leave-1', status: 'pending' }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: requests })

    await expect(leaveApi.getMyLeaveRequests()).resolves.toBe(requests)

    expect(client.get).toHaveBeenCalledWith('/api/leave/mine')
  })

  it('fetches pending team leave requests', async () => {
    const requests = [{ id: 'leave-2', status: 'pending' }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: requests })

    await expect(leaveApi.getPendingTeamLeaveRequests()).resolves.toBe(
      requests,
    )

    expect(client.get).toHaveBeenCalledWith('/api/leave/team/pending')
  })

  it('approves a leave request', async () => {
    const request = { id: 'leave-3', status: 'approved' }
    ;(client.post as Mock).mockResolvedValueOnce({ data: request })

    await expect(leaveApi.approveLeaveRequest('leave-3')).resolves.toBe(
      request,
    )

    expect(client.post).toHaveBeenCalledWith('/api/leave/leave-3/approve')
  })

  it('rejects a leave request with a reason', async () => {
    const request = { id: 'leave-4', status: 'rejected' }
    const payload = { rejection_reason: 'Coverage is too limited.' }
    ;(client.post as Mock).mockResolvedValueOnce({ data: request })

    await expect(leaveApi.rejectLeaveRequest('leave-4', payload)).resolves.toBe(
      request,
    )

    expect(client.post).toHaveBeenCalledWith(
      '/api/leave/leave-4/reject',
      payload,
    )
  })
})
