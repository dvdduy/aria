import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { client } = vi.hoisted(() => ({
  client: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('./client', () => ({ default: client }))

import { notificationsApi } from './notifications'

describe('notificationsApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetches notifications with unread count', async () => {
    const payload = {
      notifications: [{ id: 'n-1', message: 'Leave approved', is_read: false, created_at: '2026-06-01T00:00:00' }],
      unread_count: 1,
    }
    ;(client.get as Mock).mockResolvedValueOnce({ data: payload })

    await expect(notificationsApi.getMyNotifications()).resolves.toBe(payload)
    expect(client.get).toHaveBeenCalledWith('/api/notifications')
  })

  it('posts to mark all notifications read', async () => {
    ;(client.post as Mock).mockResolvedValueOnce({ data: { marked_read: 3 } })

    await notificationsApi.markAllRead()

    expect(client.post).toHaveBeenCalledWith('/api/notifications/read-all')
  })
})
