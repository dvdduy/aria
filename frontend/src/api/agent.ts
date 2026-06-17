import client from './client'

export interface ChatEnqueueResponse { job_id: string; session_id: string }
export interface JobStatusResponse   { job_id: string; status: 'pending' | 'done' | 'failed' }
export interface ToolTraceStep {
  tool: string
  status: 'success' | 'error'
  summary: string
  error_code?: string | null
}
export interface JobResultResponse {
  job_id: string
  result: string
  tool_trace: ToolTraceStep[]
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  session_id: string
  preview: string
  started_at: string
  last_message_at: string
}

export const agentApi = {
  chat: (message: string, session_id?: string) =>
    client.post<ChatEnqueueResponse>('/api/agent/chat', { message, session_id }),

  status: (job_id: string) =>
    client.get<JobStatusResponse>(`/api/agent/status/${job_id}`),

  result: (job_id: string) =>
    client.get<JobResultResponse>(`/api/agent/result/${job_id}`),

  history: (session_id: string) =>
    client.get<HistoryMessage[]>(`/api/agent/history/${session_id}`),

  sessions: () =>
    client.get<ChatSession[]>('/api/agent/sessions'),
}
