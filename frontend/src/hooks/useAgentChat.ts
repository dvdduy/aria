import { useState, useRef, useCallback, useEffect } from 'react'
import { agentApi, type ToolTraceStep } from '@/api/agent'

const SESSION_KEY = 'aria_chat_session'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  status?: 'thinking' | 'done' | 'error'
  toolTrace?: ToolTraceStep[]
}

export function useAgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | undefined>(
    sessionStorage.getItem(SESSION_KEY) ?? undefined,
  )

  // Restore history on mount if a session exists
  useEffect(() => {
    const sid = sessionIdRef.current
    if (!sid) return
    setIsLoadingHistory(true)
    agentApi.history(sid)
      .then(({ data }) => {
        if (data.length > 0) {
          setMessages(data.map((m) => ({ role: m.role, content: m.content, status: 'done' as const })))
        }
      })
      .catch(() => {
        // Session may have expired — clear it and start fresh
        sessionStorage.removeItem(SESSION_KEY)
        sessionIdRef.current = undefined
      })
      .finally(() => setIsLoadingHistory(false))
  }, [])

  const send = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsThinking(true)

    try {
      const { data } = await agentApi.chat(text, sessionIdRef.current)
      const { job_id, session_id } = data
      sessionIdRef.current = session_id
      sessionStorage.setItem(SESSION_KEY, session_id)

      pollRef.current = setInterval(async () => {
        const { data: statusData } = await agentApi.status(job_id)

        if (statusData.status === 'done') {
          clearInterval(pollRef.current!)
          const { data: resultData } = await agentApi.result(job_id)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: resultData.result,
              status: 'done',
              toolTrace: resultData.tool_trace,
            },
          ])
          setIsThinking(false)
        }

        if (statusData.status === 'failed') {
          clearInterval(pollRef.current!)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Something went wrong. Please try again.', status: 'error' },
          ])
          setIsThinking(false)
        }
      }, 2000)

    } catch {
      setIsThinking(false)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to send message.', status: 'error' },
      ])
    }
  }, [])

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    sessionIdRef.current = undefined
    sessionStorage.removeItem(SESSION_KEY)
    setMessages([])
    setIsThinking(false)
  }, [])

  return { messages, isThinking, isLoadingHistory, send, reset }
}
