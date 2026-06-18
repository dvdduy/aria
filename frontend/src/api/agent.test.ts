import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { client } = vi.hoisted(() => ({
  client: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('./client', () => ({ default: client }))

import { agentApi } from './agent'

describe('agentApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('posts a chat message without a session id', async () => {
    const response = { job_id: 'job-1', session_id: 'sess-1' }
    ;(client.post as Mock).mockResolvedValueOnce({ data: response })

    await expect(agentApi.chat('Hello')).resolves.toEqual({ data: response })
    expect(client.post).toHaveBeenCalledWith('/api/agent/chat', { message: 'Hello', session_id: undefined })
  })

  it('posts a chat message with an existing session id', async () => {
    const response = { job_id: 'job-2', session_id: 'sess-existing' }
    ;(client.post as Mock).mockResolvedValueOnce({ data: response })

    await agentApi.chat('Follow up', 'sess-existing')

    expect(client.post).toHaveBeenCalledWith('/api/agent/chat', { message: 'Follow up', session_id: 'sess-existing' })
  })

  it('polls job status by id', async () => {
    const response = { job_id: 'job-1', status: 'done' }
    ;(client.get as Mock).mockResolvedValueOnce({ data: response })

    await expect(agentApi.status('job-1')).resolves.toEqual({ data: response })
    expect(client.get).toHaveBeenCalledWith('/api/agent/status/job-1')
  })

  it('fetches job result by id', async () => {
    const response = { job_id: 'job-1', result: 'You have 15 days left.', tool_trace: [] }
    ;(client.get as Mock).mockResolvedValueOnce({ data: response })

    await expect(agentApi.result('job-1')).resolves.toEqual({ data: response })
    expect(client.get).toHaveBeenCalledWith('/api/agent/result/job-1')
  })

  it('fetches chat history for a session', async () => {
    const messages = [{ role: 'user', content: 'Hello' }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: messages })

    await expect(agentApi.history('sess-1')).resolves.toEqual({ data: messages })
    expect(client.get).toHaveBeenCalledWith('/api/agent/history/sess-1')
  })

  it('fetches the list of sessions', async () => {
    const sessions = [{ session_id: 'sess-1', preview: 'Hello', started_at: '2026-06-01T00:00:00', last_message_at: '2026-06-01T00:01:00' }]
    ;(client.get as Mock).mockResolvedValueOnce({ data: sessions })

    await expect(agentApi.sessions()).resolves.toEqual({ data: sessions })
    expect(client.get).toHaveBeenCalledWith('/api/agent/sessions')
  })
})
