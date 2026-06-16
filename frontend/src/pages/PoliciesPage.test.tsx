import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PoliciesPageView } from './PoliciesPage'

const renderView = (overrides: Partial<Parameters<typeof PoliciesPageView>[0]>) =>
  renderToStaticMarkup(
    <PoliciesPageView
      categories={['leave', 'payroll_records']}
      error={null}
      isLoading={false}
      policies={[
        {
          id: 'policy-1',
          title: 'Annual Leave Policy',
          category: 'leave',
          version: 'v2.0',
          effective_date: '2026-01-01',
        },
      ]}
      searchQuery=""
      searchedQuery=""
      onRetry={vi.fn()}
      onSearch={vi.fn()}
      onSearchQueryChange={vi.fn()}
      {...overrides}
    />,
  )

describe('PoliciesPageView', () => {
  it('renders policy categories and summaries', () => {
    const markup = renderView({})

    expect(markup).toContain('Policies')
    expect(markup).toContain('Search policies')
    expect(markup).toContain('Leave')
    expect(markup).toContain('Payroll Records')
    expect(markup).toContain('payroll_records')
    expect(markup).toContain('Annual Leave Policy')
    expect(markup).toContain('v2.0')
    expect(markup).toContain('2026-01-01')
  })

  it('renders loading, empty, and error states', () => {
    expect(renderView({ isLoading: true })).toContain('Loading policies...')
    expect(renderView({ categories: [] })).toContain(
      'No active policy categories found',
    )
    expect(renderView({ policies: [] })).toContain('No active policies found')
    expect(renderView({ policies: [], searchedQuery: 'leave' })).toContain(
      'No policies match this search',
    )
    expect(renderView({ error: 'Network error' })).toContain('Network error')
  })
})
