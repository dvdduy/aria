import { useCallback, useEffect, useState } from 'react'
import { policiesApi } from '@/api/policies'
import type { HRPolicySummary } from '@/types/models'

export interface PoliciesPageViewProps {
  categories: string[]
  error: string | null
  isLoading: boolean
  policies: HRPolicySummary[]
  searchQuery: string
  searchedQuery: string
  onRetry: () => void
  onSearch: () => void
  onSearchQueryChange: (value: string) => void
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
  policies,
  searchQuery,
  searchedQuery,
  onRetry,
  onSearch,
  onSearchQueryChange,
}: PoliciesPageViewProps) {
  const isFiltered = searchedQuery.trim().length > 0

  return (
    <main className="policies-page">
      <header className="policies-page-header">
        <div>
          <p className="policies-eyebrow">HR policies</p>
          <h1>Policies</h1>
          <p className="policies-page-subtitle">
            Browse active policy areas and search policy summaries.
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
            <strong>Policies could not be loaded.</strong>
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="card policies-loading">Loading policies...</div>
      ) : (
        <>
          <section className="card policies-search-section">
            <div className="card-header">
              <div>
                <h2 className="card-title">Search policies</h2>
                <p className="policies-section-subtitle">
                  Search by policy title or category.
                </p>
              </div>
            </div>

            <form
              className="policies-search-form"
              onSubmit={(event) => {
                event.preventDefault()
                onSearch()
              }}
            >
              <label className="field policies-search-field">
                <span className="field-label">Search query</span>
                <input
                  className="input"
                  onChange={(event) =>
                    onSearchQueryChange(event.currentTarget.value)
                  }
                  placeholder="Search title or category"
                  type="search"
                  value={searchQuery}
                />
              </label>
              <button className="btn btn-primary" type="submit">
                Search
              </button>
            </form>
          </section>

          <section aria-label="Policy categories" className="policies-section">
            <div className="policies-section-header">
              <h2>Categories</h2>
              <span>{categories.length}</span>
            </div>

            {categories.length === 0 ? (
              <div className="empty-state policies-empty-state">
                <div className="empty-state-title">
                  No active policy categories found
                </div>
                <div className="empty-state-body">
                  Active HR policy categories will appear here once policies are
                  added.
                </div>
              </div>
            ) : (
              <div className="policies-grid">
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
              </div>
            )}
          </section>

          <section aria-label="Policy results" className="policies-section">
            <div className="policies-section-header">
              <h2>{isFiltered ? 'Search results' : 'Active policies'}</h2>
              <span>{policies.length}</span>
            </div>

            {policies.length === 0 ? (
              <div className="empty-state policies-empty-state">
                <div className="empty-state-title">
                  {isFiltered
                    ? 'No policies match this search'
                    : 'No active policies found'}
                </div>
                <div className="empty-state-body">
                  {isFiltered
                    ? 'Try another policy title or category.'
                    : 'Active policy summaries will appear here once policies are added.'}
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table policies-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Version</th>
                      <th>Effective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy) => (
                      <tr key={policy.id}>
                        <td>{policy.title}</td>
                        <td>{formatPolicyCategory(policy.category)}</td>
                        <td>{policy.version}</td>
                        <td>{policy.effective_date ?? 'Not set'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default function PoliciesPage() {
  const [categories, setCategories] = useState<string[]>([])
  const [policies, setPolicies] = useState<HRPolicySummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')

  const loadPolicyData = useCallback(async (query = '') => {
    setIsLoading(true)
    setError(null)
    try {
      const [categoryData, policyData] = await Promise.all([
        policiesApi.getPolicyCategories(),
        policiesApi.searchPolicies(query),
      ])
      setCategories(categoryData.categories)
      setPolicies(policyData)
      setSearchedQuery(query.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected API error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPolicyData()
  }, [loadPolicyData])

  const handleSearch = () => {
    void loadPolicyData(searchQuery)
  }

  return (
    <PoliciesPageView
      categories={categories}
      error={error}
      isLoading={isLoading}
      policies={policies}
      searchQuery={searchQuery}
      searchedQuery={searchedQuery}
      onRetry={() => void loadPolicyData(searchedQuery)}
      onSearch={handleSearch}
      onSearchQueryChange={setSearchQuery}
    />
  )
}
