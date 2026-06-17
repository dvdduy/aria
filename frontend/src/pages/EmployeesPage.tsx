import { useEffect, useState } from 'react'
import { employeesApi, type EmployeeCreateBody, type EmployeeUpdateBody } from '@/api/employees'
import type { Employee } from '@/types/models'

// ── helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'var(--color-info-50)',   color: 'var(--color-info-800)'  },
  { bg: 'var(--color-teal-50)',   color: 'var(--color-teal-800)'  },
  { bg: 'var(--color-pink-50)',   color: 'var(--color-pink-800)'  },
  { bg: 'var(--color-green-50)',  color: 'var(--color-green-800)' },
  { bg: 'var(--color-brand-50)',  color: 'var(--color-brand-800)' },
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

// ── employee form modal ───────────────────────────────────────────────────────

interface FormState {
  full_name: string
  email: string
  role: string
  department: string
  manager_id: string
  start_date: string
  temp_password: string
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  role: '',
  department: '',
  manager_id: '',
  start_date: '',
  temp_password: '',
}

interface EmployeeModalProps {
  initial: Employee | null
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

function EmployeeModal({ initial, employees, onClose, onSaved }: EmployeeModalProps) {
  const isEdit = initial !== null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const [form, setForm] = useState<FormState>(
    initial
      ? {
          full_name: initial.full_name,
          email: initial.email,
          role: initial.role ?? '',
          department: initial.department ?? '',
          manager_id: initial.manager_id ?? '',
          start_date: initial.start_date ?? '',
          temp_password: '',
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        const body: EmployeeUpdateBody = {
          full_name: form.full_name.trim(),
          role: form.role.trim() || null,
          department: form.department.trim() || null,
          manager_id: form.manager_id || null,
          start_date: form.start_date || null,
        }
        await employeesApi.updateEmployee(initial.id, body)
      } else {
        const body: EmployeeCreateBody = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          role: form.role.trim() || null,
          department: form.department.trim() || null,
          manager_id: form.manager_id || null,
          start_date: form.start_date || null,
          temp_password: form.temp_password,
        }
        await employeesApi.createEmployee(body)
      }
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // filter out the employee being edited from manager options
  const managerOptions = employees.filter(
    (e) => e.is_active && (!initial || e.id !== initial.id),
  )

  return (
    <div
      className="pol-backdrop"
      onClick={(e) => { if (e.currentTarget === e.target) onClose() }}
    >
      <div className="pol-modal" role="dialog" aria-modal="true">
        <div className="pol-modal-hdr">
          <h2>{isEdit ? 'Edit employee' : 'New employee'}</h2>
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
              <span className="field-label">Full name *</span>
              <input className="input" required value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" />
            </label>
            <label className="field pol-field-grow">
              <span className="field-label">Email *</span>
              <input className="input" type="email" required disabled={isEdit} value={form.email} onChange={set('email')} placeholder="jane@company.com" />
            </label>
          </div>

          <div className="pol-row">
            <label className="field pol-field-grow">
              <span className="field-label">Role</span>
              <input className="input" value={form.role} onChange={set('role')} placeholder="Software Engineer" />
            </label>
            <label className="field pol-field-grow">
              <span className="field-label">Department</span>
              <input className="input" value={form.department} onChange={set('department')} placeholder="Engineering" />
            </label>
          </div>

          <div className="pol-row">
            <label className="field pol-field-grow">
              <span className="field-label">Manager</span>
              <select className="input" value={form.manager_id} onChange={set('manager_id')}>
                <option value="">— No manager —</option>
                {managerOptions.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="field pol-field-grow">
              <span className="field-label">Start date</span>
              <input className="input" type="date" value={form.start_date} onChange={set('start_date')} />
            </label>
          </div>

          {!isEdit && (
            <label className="field">
              <span className="field-label">Temporary password *</span>
              <input className="input" type="password" required value={form.temp_password} onChange={set('temp_password')} placeholder="Employee will use this to log in" />
            </label>
          )}

          <div className="pol-modal-footer">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setEmployees(await employeesApi.listAll())
    } catch {
      setError('Could not load employees.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const nameMap = new Map(employees.map((e) => [e.id, e.full_name]))

  const visible = employees.filter((e) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      e.full_name.toLowerCase().includes(q) ||
      (e.role ?? '').toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q)
    )
  })

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (emp: Employee) => { setEditTarget(emp); setModalOpen(true) }

  const handleToggleActive = async (emp: Employee) => {
    const action = emp.is_active ? 'deactivate' : 'reactivate'
    const label = emp.is_active ? 'deactivate' : 'reactivate'
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${emp.full_name}?`)) return
    try {
      if (emp.is_active) {
        await employeesApi.deactivateEmployee(emp.id)
      } else {
        await employeesApi.reactivateEmployee(emp.id)
      }
      void load()
    } catch {
      setError(`Failed to ${action} employee.`)
    }
  }

  const activeCount = employees.filter((e) => e.is_active).length

  return (
    <div className="pol-page">
      <div className="page-topbar">
        <span className="page-topbar-title">Employees</span>
        <div className="pol-search-wrap">
          <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="pol-search-input"
            placeholder="Search employees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate} type="button">
          + New employee
        </button>
      </div>

      <div className="pp">
        {error && (
          <div className="toast toast-error" style={{ marginBottom: 12 }}>{error}</div>
        )}

        <div className="emp-summary">
          <span className="emp-count">{activeCount} active</span>
          <span className="emp-count-sep">·</span>
          <span className="emp-count emp-count-dim">{employees.length - activeCount} inactive</span>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', padding: '12px 0' }}>
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            {search.trim() ? (
              <>
                <div className="empty-state-title">No employees match "{search.trim()}"</div>
                <div className="empty-state-body">Try a different name, role, department, or email.</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setSearch('')} type="button">Clear search</button>
              </>
            ) : (
              <>
                <div className="empty-state-title">No employees yet</div>
                <div className="empty-state-body">Create the first employee to get started.</div>
              </>
            )}
          </div>
        ) : (
          <div className="list-card">
            {visible.map((emp) => {
              const col = avatarColor(emp.full_name)
              const managerName = emp.manager_id ? (nameMap.get(emp.manager_id) ?? null) : null
              return (
                <div className={`list-row${emp.is_active ? '' : ' emp-row-inactive'}`} key={emp.id}>
                  <div className="av" style={{ background: col.bg, color: col.color, flexShrink: 0 }}>
                    {initials(emp.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lname">
                      {emp.full_name}
                      {!emp.is_active && <span className="emp-badge-inactive">Inactive</span>}
                    </div>
                    <div className="lmeta">
                      {emp.email}
                      {[emp.role, emp.department].filter(Boolean).length > 0 && ` · ${[emp.role, emp.department].filter(Boolean).join(' · ')}`}
                      {managerName ? ` · Reports to ${managerName}` : ''}
                    </div>
                  </div>
                  <div className="pol-actions-cell">
                    <button
                      className="btn btn-secondary btn-xs"
                      type="button"
                      onClick={() => openEdit(emp)}
                    >
                      Edit
                    </button>
                    <button
                      className={`btn btn-xs ${emp.is_active ? 'btn-danger' : 'btn-secondary'}`}
                      type="button"
                      onClick={() => void handleToggleActive(emp)}
                    >
                      {emp.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <EmployeeModal
          initial={editTarget}
          employees={employees}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); void load() }}
        />
      )}
    </div>
  )
}
