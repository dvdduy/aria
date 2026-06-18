import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChatPage from './ChatPage'
import * as useAgentChatModule from '@/hooks/useAgentChat'
import * as employeesApiModule from '@/api/employees'

vi.mock('@/hooks/useAgentChat', () => ({
  useAgentChat: vi.fn(),
}))

vi.mock('@/api/employees', () => ({
  employeesApi: { getDirectReports: vi.fn() },
}))

// ReactMarkdown uses ESM — stub it so tests don't need bundler transforms
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <>{children}</>,
}))

function makeToken(claims: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(claims))}.sig`
}

const defaultChat = {
  messages: [] as useAgentChatModule.Message[],
  isThinking: false,
  isLoadingHistory: false,
  sessionId: undefined as string | undefined,
  send: vi.fn(),
  loadSession: vi.fn(),
  reset: vi.fn(),
}

function renderPage(route = '/chat') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ChatPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({ ...defaultChat })
  vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([])
  sessionStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('ChatPage', () => {
  it('shows greeting bubble when there are no messages', () => {
    renderPage()

    expect(screen.getByText(/Hi there!/)).toBeTruthy()
  })

  it('uses first name from JWT in greeting', () => {
    sessionStorage.setItem('aria_token', makeToken({ name: 'Alice Smith' }))
    renderPage()

    expect(screen.getByText(/Hi Alice!/)).toBeTruthy()
  })

  it('shows employee suggestions by default', () => {
    renderPage()

    expect(screen.getByText('How many annual leave days do I have left?')).toBeTruthy()
  })

  it('shows manager suggestions when user has direct reports', async () => {
    vi.mocked(employeesApiModule.employeesApi.getDirectReports).mockResolvedValue([
      { id: 'emp-1', full_name: 'Bob Jones', email: 'b@example.com', role: 'Engineer', department: 'Eng', is_active: true, manager_id: null, start_date: null, manager_name: null },
    ])

    renderPage()

    expect(await screen.findByText("Show my team's pending leave requests")).toBeTruthy()
  })

  it('shows admin suggestions when token has is_admin=true', () => {
    sessionStorage.setItem('aria_token', makeToken({ is_admin: true }))
    renderPage()

    expect(screen.getByText('What HR policies are currently active?')).toBeTruthy()
  })

  it('clicking a suggestion populates the textarea', () => {
    renderPage()

    fireEvent.click(screen.getByText('How many annual leave days do I have left?'))

    const textarea = screen.getByPlaceholderText('Message HR Agent...') as HTMLTextAreaElement
    expect(textarea.value).toBe('How many annual leave days do I have left?')
  })

  it('send button is disabled when textarea is empty', () => {
    renderPage()

    const btn = screen.getByRole('button', { name: '↑' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('send button is enabled after typing', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Message HR Agent...'), {
      target: { value: 'Hello' },
    })

    const btn = screen.getByRole('button', { name: '↑' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls send when the send button is clicked', async () => {
    const send = vi.fn()
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({ ...defaultChat, send })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Message HR Agent...'), {
      target: { value: 'Hello' },
    })
    fireEvent.click(screen.getByRole('button', { name: '↑' }))

    await waitFor(() => expect(send).toHaveBeenCalledWith('Hello'))
  })

  it('calls send when Enter is pressed in textarea', async () => {
    const send = vi.fn()
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({ ...defaultChat, send })

    renderPage()

    const textarea = screen.getByPlaceholderText('Message HR Agent...')
    fireEvent.change(textarea, { target: { value: 'Enter test' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => expect(send).toHaveBeenCalledWith('Enter test'))
  })

  it('does not send on Shift+Enter', () => {
    const send = vi.fn()
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({ ...defaultChat, send })

    renderPage()

    const textarea = screen.getByPlaceholderText('Message HR Agent...')
    fireEvent.change(textarea, { target: { value: 'multiline' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(send).not.toHaveBeenCalled()
  })

  it('shows thinking bubble while isThinking', () => {
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
      ...defaultChat,
      isThinking: true,
    })

    renderPage()

    expect(screen.getByText('Working on it...')).toBeTruthy()
  })

  it('renders user and assistant message bubbles', () => {
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
      ...defaultChat,
      messages: [
        { role: 'user', content: 'Hello agent' },
        { role: 'assistant', content: 'Hello! How can I help?' },
      ],
    })

    renderPage()

    expect(screen.getByText('Hello agent')).toBeTruthy()
    expect(screen.getByText('Hello! How can I help?')).toBeTruthy()
  })

  it('hides greeting when messages are present', () => {
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
      ...defaultChat,
      messages: [{ role: 'user', content: 'Hi' }],
    })

    renderPage()

    expect(screen.queryByText(/Hi there!/)).toBeNull()
  })

  it('hides greeting while loading history', () => {
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
      ...defaultChat,
      isLoadingHistory: true,
    })

    renderPage()

    expect(screen.queryByText(/Hi there!/)).toBeNull()
  })

  it('shows agent thinking trace when message has toolTrace', () => {
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({
      ...defaultChat,
      messages: [
        {
          role: 'assistant',
          content: 'Done.',
          toolTrace: [{ tool: 'get_leave_request', summary: 'get_leave_request → found 2 requests', status: 'ok' }],
        },
      ],
    })

    renderPage()

    expect(screen.getByText('▶ Agent actions')).toBeTruthy()
    expect(screen.getByText(/get_leave_request/)).toBeTruthy()
  })

  it('calls loadSession when ?session= param is present', async () => {
    const loadSession = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({ ...defaultChat, loadSession })

    renderPage('/chat?session=sess-abc')

    await waitFor(() => expect(loadSession).toHaveBeenCalledWith('sess-abc'))
  })

  it('calls reset when ?new=1 param is present', async () => {
    const reset = vi.fn()
    vi.mocked(useAgentChatModule.useAgentChat).mockReturnValue({ ...defaultChat, reset })

    renderPage('/chat?new=1')

    await waitFor(() => expect(reset).toHaveBeenCalled())
  })
})
