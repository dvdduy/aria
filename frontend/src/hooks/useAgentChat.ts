import { useState, useRef, useCallback } from 'react'
import { agentApi, type ToolTraceStep } from '@/api/agent'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  status?: 'thinking' | 'done' | 'error'
  toolTrace?: ToolTraceStep[]
}

export function useAgentChat(sessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const send = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsThinking(true)

    try {
      const { data } = await agentApi.chat(text, sessionId)
      const { job_id } = data

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
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.', status: 'error' }])
          setIsThinking(false)
        }
      }, 2000)

    } catch {
      setIsThinking(false)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to send message.', status: 'error' }])
    }
  }, [sessionId])

  return { messages, isThinking, send }
}
