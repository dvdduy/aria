import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useSearchParams } from 'react-router-dom'
import type { ToolTraceStep } from '@/api/agent'
import { employeesApi } from '@/api/employees'
import { useAgentChat, type Message } from '@/hooks/useAgentChat'

// ── suggestions ───────────────────────────────────────────────────────────────

const EMPLOYEE_SUGGESTIONS = [
  "How many annual leave days do I have left?",
  "I need to take sick leave tomorrow",
  "What's the parental leave policy?",
  "When does my leave balance reset?",
]

const MANAGER_SUGGESTIONS = [
  "Show my team's pending leave requests",
  "Who's on leave this week?",
  "What's the annual leave entitlement?",
  "Approve a leave request for my team",
]

const ADMIN_SUGGESTIONS = [
  "What HR policies are currently active?",
  "Show all pending leave requests",
  "How do I onboard a new employee?",
  "What's the code of conduct policy?",
]

// ── helpers ───────────────────────────────────────────────────────────────────

function decodeTokenClaims(token: string): { name?: string; email?: string; is_admin?: boolean } {
  try {
    return JSON.parse(atob(token.split('.')[1])) as { name?: string; email?: string; is_admin?: boolean }
  } catch {
    return {}
  }
}

function getUserInitials(): string {
  const token = sessionStorage.getItem('aria_token') ?? ''
  const { name, email } = decodeTokenClaims(token)
  const src = name ?? email ?? ''
  const parts = src.split(/[\s._@-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase() || '?'
}

function getUserFirstName(): string {
  const token = sessionStorage.getItem('aria_token') ?? ''
  const { name, email } = decodeTokenClaims(token)
  const src = name ?? email ?? ''
  return src.split(/[\s._@]/)[0] || 'there'
}

// ── sub-components ────────────────────────────────────────────────────────────

function ToolTrace({ steps }: { steps: ToolTraceStep[] }) {
  return (
    <div className="trace">
      <div className="trace-hdr">▶ Agent actions</div>
      {steps.map((step, i) => (
        <div className={`trace-step${step.status === 'error' ? ' err' : ''}`} key={i}>
          {step.summary}
        </div>
      ))}
    </div>
  )
}

function MessageBubble({ initials, message }: { message: Message; initials: string }) {
  const isUser = message.role === 'user'
  return (
    <div className={`msg-row${isUser ? ' user' : ''}`}>
      <div className={`msg-av ${isUser ? 'user' : 'agent'}`}>
        {isUser ? initials : 'HR'}
      </div>
      <div className={`bubble ${isUser ? 'user' : 'agent'}`}>
        {isUser ? message.content : (
          <div className="md">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.toolTrace && message.toolTrace.length > 0 && (
          <ToolTrace steps={message.toolTrace} />
        )}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="msg-row">
      <div className="msg-av agent">HR</div>
      <div className="bubble thinking">
        <div className="dots">
          <span /><span /><span />
        </div>
        Working on it...
      </div>
    </div>
  )
}

function GreetingBubble({ firstName }: { firstName: string }) {
  return (
    <div className="msg-row">
      <div className="msg-av agent">HR</div>
      <div className="bubble agent">
        Hi {firstName}! I can help you approve leave requests, look up HR policies, check payroll,
        and more. What would you like to do?
      </div>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { messages, isThinking, isLoadingHistory, send, loadSession, reset } = useAgentChat()
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState(EMPLOYEE_SUGGESTIONS)
  const [searchParams, setSearchParams] = useSearchParams()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initials = getUserInitials()
  const firstName = getUserFirstName()

  const showGreeting = messages.length === 0 && !isThinking && !isLoadingHistory

  // Role-aware suggestions
  useEffect(() => {
    const token = sessionStorage.getItem('aria_token') ?? ''
    const { is_admin } = decodeTokenClaims(token)
    if (is_admin) { setSuggestions(ADMIN_SUGGESTIONS); return }
    employeesApi.getDirectReports()
      .then((reports) => { if (reports.length > 0) setSuggestions(MANAGER_SUGGESTIONS) })
      .catch(() => {})
  }, [])

  // Handle ?session= and ?new=1 URL params from sidebar clicks
  useEffect(() => {
    const sessionParam = searchParams.get('session')
    const newParam = searchParams.get('new')
    if (sessionParam) {
      setSearchParams({}, { replace: true })
      void loadSession(sessionParam)
    } else if (newParam === '1') {
      setSearchParams({}, { replace: true })
      reset()
    }
  }, [searchParams, setSearchParams, loadSession, reset])

  // Scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    void send(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  const useSuggestion = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="chat-page">
      <div className="page-topbar">
        <span className="page-topbar-title">Chat</span>
      </div>

      <div className="chat-msgs">
        {showGreeting && <GreetingBubble firstName={firstName} />}
        {messages.map((msg, i) => (
          <MessageBubble initials={initials} key={i} message={msg} />
        ))}
        {isThinking && <ThinkingBubble />}
        <div ref={bottomRef} />
      </div>

      <div className="sugg-row">
        {suggestions.map((s) => (
          <button className="sugg-btn" key={s} onClick={() => useSuggestion(s)} type="button">
            {s}
          </button>
        ))}
      </div>

      <div className="chat-input-wrap">
        <div className="chat-box">
          <textarea
            className="chat-ta"
            disabled={isThinking}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message HR Agent..."
            ref={textareaRef}
            rows={1}
            value={input}
          />
          <button
            className="send-btn"
            disabled={!input.trim() || isThinking}
            onClick={handleSend}
            type="button"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
