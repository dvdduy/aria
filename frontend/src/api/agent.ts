import client from './client'

export interface ChatEnqueueResponse { job_id: string; session_id: string }
export interface JobStatusResponse   { job_id: string; status: 'pending' | 'done' | 'failed' }
export interface JobResultResponse   { job_id: string; result: string }

export const agentApi = {
  chat: (message: string, session_id?: string) =>
    client.post<ChatEnqueueResponse>('/api/agent/chat', { message, session_id }),

  status: (job_id: string) =>
    client.get<JobStatusResponse>(`/api/agent/status/${job_id}`),

  result: (job_id: string) =>
    client.get<JobResultResponse>(`/api/agent/result/${job_id}`),
}
