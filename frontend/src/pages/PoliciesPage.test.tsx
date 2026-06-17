import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PoliciesPage from './PoliciesPage'
import * as policiesApiModule from '@/api/policies'

vi.mock('@/api/policies', () => ({
  policiesApi: {
    searchPolicies: vi.fn(),
    getPolicy: vi.fn(),
    createPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    deletePolicy: vi.fn(),
  },
}))

const mockPolicies = [
  { id: 'p1', title: 'Annual Leave Policy', category: 'leave', version: 'v2.0', effective_date: '2026-01-01' },
  { id: 'p2', title: 'Payroll & Compensation Policy', category: 'payroll', version: 'v1.2', effective_date: null },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <PoliciesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(policiesApiModule.policiesApi.searchPolicies).mockResolvedValue(mockPolicies)
  sessionStorage.clear()
})

describe('PoliciesPage', () => {
  it('renders policy list after loading', async () => {
    renderPage()
    expect(await screen.findByText('Annual Leave Policy')).toBeTruthy()
    expect(screen.getByText('Payroll & Compensation Policy')).toBeTruthy()
  })

  it('shows filter pills', async () => {
    renderPage()
    await screen.findByText('Annual Leave Policy')
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Leave')).toBeTruthy()
    expect(screen.getByText('Payroll')).toBeTruthy()
  })

  it('shows no admin controls for non-admin users', async () => {
    renderPage()
    await screen.findByText('Annual Leave Policy')
    expect(screen.queryByText('+ New policy')).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
  })
})
