import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { policiesApi } from '@/api/policies'
import type { HRPolicy, HRPolicySummary } from '@/types/models'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCategory(cat: string) {
  return cat
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function formatEffective(date: string | null) {
  if (!date) return null
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function isAdmin(): boolean {
  try {
    const token = sessionStorage.getItem('aria_token') ?? ''
    const claims = JSON.parse(atob(token.split('.')[1])) as { is_admin?: boolean }
    return claims.is_admin === true
  } catch {
    return false
  }
}

// ── policy form modal ─────────────────────────────────────────────────────────

const CATEGORIES = ['leave', 'payroll', 'conduct', 'onboarding']

interface FormState {
  title: string
  category: string
  version: string
  effective_date: string
  content: string
}

const EMPTY_FORM: FormState = {
  title: '',
  category: 'leave',
  version: 'v1.0',
  effective_date: '',
  content: '',
}

interface PolicyModalProps {
  initial: HRPolicy | null
  onClose: () => void
  onSaved: () => void
}

function PolicyModal({ initial, onClose, onSaved }: PolicyModalProps) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          title: initial.title,
          category: initial.category,
          version: initial.version,
          effective_date: initial.effective_date ?? '',
          content: initial.content,
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        title: form.title.trim(),
        category: form.category.trim(),
        content: form.content.trim(),
        version: form.version.trim(),
        effective_date: form.effective_date || null,
      }
      if (initial) {
        await policiesApi.updatePolicy(initial.id, body)
      } else {
        await policiesApi.createPolicy(body)
      }
      onSaved()
    } catch {
      setError('Failed to save policy. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pol-backdrop" onClick={(e) => { if (e.currentTarget === e.target) onClose() }}>
      <div className="pol-modal" role="dialog" aria-modal="true">
        <div className="pol-modal-hdr">
          <h2>{initial ? 'Edit policy' : 'New policy'}</h2>
          <button className="btn-icon" onClick={onClose} type="button" aria-label="Close">
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && <div className="toast toast-error pol-error">{error}</div>}

        <form className="pol-modal-body" onSubmit={handleSubmit}>
          <div className="pol-row">
            <label className="field pol-field-grow">
              <span className="field-label">Title *</span>
              <input className="input" required value={form.title} onChange={set('title')} placeholder="e.g. Annual Leave Policy" />
            </label>
            <label className="field">
              <span className="field-label">Version *</span>
              <input className="input pol-version-input" required value={form.version} onChange={set('version')} placeholder="v1.0" />
            </label>
          </div>

          <div className="pol-row">
            <label className="field pol-field-grow">
              <span className="field-label">Category *</span>
              <select className="input" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{formatCategory(c)}</option>
                ))}
                {!CATEGORIES.includes(form.category) && (
                  <option value={form.category}>{formatCategory(form.category)}</option>
                )}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Effective date</span>
              <input className="input" type="date" value={form.effective_date} onChange={set('effective_date')} />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Content *</span>
            <textarea
              className="input pol-content-area"
              required
              value={form.content}
              onChange={set('content')}
              placeholder="Write the full policy text here…"
            />
          </label>

          <div className="pol-modal-footer">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── policy detail drawer ──────────────────────────────────────────────────────

interface PolicyDrawerProps {
  policy: HRPolicy
  admin: boolean
  onClose: () => void
  onEdit: (p: HRPolicy) => void
  onDelete: (id: string, title: string) => void
}

function PolicyDrawer({ policy, admin, onClose, onEdit, onDelete }: PolicyDrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div className="pol-drawer-backdrop" onClick={onClose} />
      <div className="pol-drawer" role="dialog" aria-modal="true">
        <div className="pol-drawer-hdr">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pol-drawer-title">{policy.title}</div>
            <div className="pol-drawer-meta">
              {formatCategory(policy.category)} · {policy.version}
              {policy.effective_date ? ` · Effective ${formatEffective(policy.effective_date)}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {admin && (
              <button
                className="btn btn-secondary btn-xs"
                type="button"
                onClick={() => onEdit(policy)}
              >
                Edit
              </button>
            )}
            {admin && (
              <button
                className="btn btn-danger btn-xs"
                type="button"
                onClick={() => onDelete(policy.id, policy.title)}
              >
                Delete
              </button>
            )}
            <button className="btn-icon" onClick={onClose} type="button" aria-label="Close">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="pol-drawer-body">
          <p className="pol-drawer-content">{policy.content}</p>
        </div>
      </div>
    </>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

const FILTER_PILLS = ['All', 'Leave', 'Payroll', 'Conduct', 'Onboarding']

export default function PoliciesPage() {
  const admin = isAdmin()
  const [allPolicies, setAllPolicies] = useState<HRPolicySummary[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // drawer state
  const [drawerPolicy, setDrawerPolicy] = useState<HRPolicy | null>(null)

  // edit modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<HRPolicy | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await policiesApi.searchPolicies()
      setAllPolicies(data)
    } catch {
      setError('Could not load policies.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = allPolicies.filter((p) => {
    const matchesFilter =
      activeFilter === 'All' || p.category.toLowerCase() === activeFilter.toLowerCase()
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const openDrawer = async (id: string) => {
    try {
      const full = await policiesApi.getPolicy(id)
      setDrawerPolicy(full)
    } catch {
      setError('Could not load policy.')
    }
  }

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }

  const openEdit = (policy: HRPolicy) => {
    setDrawerPolicy(null)
    setEditTarget(policy)
    setModalOpen(true)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await policiesApi.deletePolicy(id)
      setDrawerPolicy(null)
      void load()
    } catch {
      setError('Failed to delete policy.')
    }
  }

  return (
    <div className="pol-page">
      {/* topbar */}
      <div className="page-topbar">
        <span className="page-topbar-title">HR policies</span>
        <div className="pol-search-wrap">
          <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="pol-search-input"
            placeholder="Search policies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {admin && (
          <button className="btn btn-primary btn-sm" onClick={openCreate} type="button">
            + New policy
          </button>
        )}
      </div>

      <div className="pp">
        {error && <div className="toast toast-error" style={{ marginBottom: 12 }}>{error}</div>}

        {/* filter pills */}
        <div className="filter-row">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill}
              className={`fp${activeFilter === pill ? ' active' : ''}`}
              type="button"
              onClick={() => setActiveFilter(pill)}
            >
              {pill}
            </button>
          ))}
        </div>

        {/* policy list */}
        {isLoading ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', padding: '12px 0' }}>
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" x2="15" y1="13" y2="13"/><line x1="9" x2="15" y1="17" y2="17"/></svg>
            </div>
            {search.trim() ? (
              <>
                <div className="empty-state-title">No policies match "{search.trim()}"</div>
                <div className="empty-state-body">Try a different search term or clear the filter.</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setSearch('')} type="button">Clear search</button>
              </>
            ) : activeFilter !== 'All' ? (
              <>
                <div className="empty-state-title">No {activeFilter.toLowerCase()} policies yet</div>
                <div className="empty-state-body">Policies in this category will appear here once added.</div>
              </>
            ) : (
              <>
                <div className="empty-state-title">No policies yet</div>
                <div className="empty-state-body">HR policies will appear here once they've been added.</div>
              </>
            )}
          </div>
        ) : (
          <div className="list-card">
            {visible.map((p) => (
              <div
                className="list-row pol-row-clickable"
                key={p.id}
                onClick={() => void openDrawer(p.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lname">{p.title}</div>
                  <div className="lmeta">
                    {formatCategory(p.category)} · {p.version}
                    {p.effective_date ? ` · ${formatEffective(p.effective_date)}` : ''}
                  </div>
                </div>
                {admin ? (
                  <div className="pol-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-secondary btn-xs"
                      type="button"
                      onClick={async () => {
                        const full = await policiesApi.getPolicy(p.id)
                        openEdit(full)
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-danger btn-xs" type="button" onClick={() => void handleDelete(p.id, p.title)}>Delete</button>
                  </div>
                ) : (
                  <span className="pol-chevron">›</span>
                )}
              </div>
            ))}
          </div>
        )}

        <Link className="tb-btn" to="/chat">Ask HR Agent about a policy ↗</Link>
      </div>

      {drawerPolicy && (
        <PolicyDrawer
          policy={drawerPolicy}
          admin={admin}
          onClose={() => setDrawerPolicy(null)}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {modalOpen && (
        <PolicyModal
          initial={editTarget}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); void load() }}
        />
      )}
    </div>
  )
}
