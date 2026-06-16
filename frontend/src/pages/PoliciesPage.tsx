import { useCallback, useEffect, useState } from 'react'
import { policiesApi } from '@/api/policies'

export interface PoliciesPageViewProps {
  categories: string[]
  error: string | null
  isLoading: boolean
  onRetry: () => void
}

function formatPolicyCategory(category: string) {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function PoliciesPageView({
  categories,
  error,
  isLoading,
  onRetry,
}: PoliciesPageViewProps) {
  return (
    <main className="policies-page">
      <header className="policies-page-header">
        <div>
          <p className="policies-eyebrow">HR policies</p>
          <h1>Policy categories</h1>
          <p className="policies-page-subtitle">
            Browse active policy areas available in Aria.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          disabled={isLoading}
          onClick={onRetry}
          type="button"
        >
          Refresh
        </button>
      </header>

      {error ? (
        <div className="toast toast-error policies-error" role="alert">
          <div>
            <strong>Policy categories could not be loaded.</strong>
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="card policies-loading">Loading policy categories...</div>
      ) : categories.length === 0 ? (
        <div className="empty-state policies-empty-state">
          <div className="empty-state-title">No active policy categories found</div>
          <div className="empty-state-body">
            Active HR policy categories will appear here once policies are added.
          </div>
        </div>
      ) : (
        <section aria-label="Policy categories" className="policies-grid">
          {categories.map((category) => (
            <button
              className="card card-clickable policy-category-card"
              key={category}
              type="button"
            >
              <span className="policy-category-title">
                {formatPolicyCategory(category)}
              </span>
              <span className="policy-category-key">{category}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  )
}

export default function PoliciesPage() {
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await policiesApi.getPolicyCategories()
      setCategories(data.categories)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected API error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  return (
    <PoliciesPageView
      categories={categories}
      error={error}
      isLoading={isLoading}
      onRetry={() => void loadCategories()}
    />
  )
}
