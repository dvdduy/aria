import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  {
    to: '/',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <rect height="7" rx="1" width="7" x="3" y="3"/>
        <rect height="7" rx="1" width="7" x="14" y="3"/>
        <rect height="7" rx="1" width="7" x="3" y="14"/>
        <rect height="7" rx="1" width="7" x="14" y="14"/>
      </svg>
    ),
  },
  {
    to: '/chat',
    label: 'Chat',
    icon: (
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    to: '/leave',
    label: 'Leave',
    icon: (
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <rect height="18" rx="2" width="18" x="3" y="4"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
        <path d="M10 16l2 2 4-4"/>
      </svg>
    ),
  },
  {
    to: '/team',
    label: 'Team',
    icon: (
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    to: '/policies',
    label: 'Policies',
    icon: (
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" x2="15" y1="13" y2="13"/>
        <line x1="9" x2="15" y1="17" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/payroll',
    label: 'Payroll',
    icon: (
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
        <rect height="14" rx="2" width="20" x="2" y="5"/>
        <line x1="2" x2="22" y1="10" y2="10"/>
      </svg>
    ),
  },
]

function decodeTokenEmail(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.email ?? payload.sub ?? '') as string
  } catch {
    return ''
  }
}

function getInitials(email: string): string {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export default function AppLayout() {
  const token = sessionStorage.getItem('aria_token') ?? ''
  const email = decodeTokenEmail(token)
  const initials = email ? getInitials(email) : '?'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-app-name">
            <div className="sidebar-logo">A</div>
            Aria
          </div>
        </div>

        <nav className="nav-section">
          <div className="nav-label">Workspace</div>
          {NAV.map(({ end, icon, label, to }) => (
            <NavLink
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              end={end}
              key={to}
              to={to}
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar avatar-sm">{initials}</div>
            <div>
              <div className="user-name">{email || 'Unknown'}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}
