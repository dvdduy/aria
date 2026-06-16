import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PoliciesPageView } from './PoliciesPage'

const renderView = (overrides: Partial<Parameters<typeof PoliciesPageView>[0]>) =>
  renderToStaticMarkup(
    <PoliciesPageView
      categories={['leave', 'payroll_records']}
      error={null}
      isLoading={false}
      onRetry={vi.fn()}
      {...overrides}
    />,
  )

describe('PoliciesPageView', () => {
  it('renders policy categories', () => {
    const markup = renderView({})

    expect(markup).toContain('Policy categories')
    expect(markup).toContain('Leave')
    expect(markup).toContain('Payroll Records')
    expect(markup).toContain('payroll_records')
  })

  it('renders loading, empty, and error states', () => {
    expect(renderView({ isLoading: true })).toContain(
      'Loading policy categories...',
    )
    expect(renderView({ categories: [] })).toContain(
      'No active policy categories found',
    )
    expect(renderView({ error: 'Network error' })).toContain('Network error')
  })
})
