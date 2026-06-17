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
  const [sessionId, setSessionIdState] = useState<string | undefined>(
    sessionStorage.getItem(SESSION_KEY) ?? undefined,
  )
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | undefined>(
    sessionStorage.getItem(SESSION_KEY) ?? undefined,
  )

  const setSession = useCallback((id: string | undefined) => {
    sessionIdRef.current = id
    setSessionIdState(id)
    if (id) sessionStorage.setItem(SESSION_KEY, id)
    else sessionStorage.removeItem(SESSION_KEY)
  }, [])

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
        setSession(undefined)
      })
      .finally(() => setIsLoadingHistory(false))
  }, [setSession])

  const loadSession = useCallback(async (sid: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    setIsThinking(false)
    setIsLoadingHistory(true)
    setMessages([])
    try {
      const { data } = await agentApi.history(sid)
      setMessages(data.map((m) => ({ role: m.role, content: m.content, status: 'done' as const })))
      setSession(sid)
    } catch {
      // session expired or not found
    } finally {
      setIsLoadingHistory(false)
    }
  }, [setSession])

  const send = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsThinking(true)

    try {
      const { data } = await agentApi.chat(text, sessionIdRef.current)
      const { job_id, session_id } = data
      setSession(session_id)

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
  }, [setSession])

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    setSession(undefined)
    setMessages([])
    setIsThinking(false)
  }, [setSession])

  return { messages, isThinking, isLoadingHistory, sessionId, send, loadSession, reset }
}
