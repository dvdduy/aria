import client from './client'
import type { Notification } from '@/types/models'

export interface NotificationsResponse {
  notifications: Notification[]
  unread_count: number
}

export const notificationsApi = {
  async getMyNotifications() {
    const { data } = await client.get<NotificationsResponse>('/api/notifications')
    return data
  },

  async markAllRead() {
    await client.post('/api/notifications/read-all')
  },
}
