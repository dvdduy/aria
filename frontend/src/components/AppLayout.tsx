import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { notificationsApi } from '@/api/notifications'
import type { Notification } from '@/types/models'

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

function decodeTokenClaims(token: string): { name?: string; email?: string; is_admin?: boolean } {
  try {
    return JSON.parse(atob(token.split('.')[1])) as { name?: string; email?: string; is_admin?: boolean }
  } catch {
    return {}
  }
}

function getInitials(displayName: string): string {
  const parts = displayName.split(/[\s._@-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return displayName.slice(0, 2).toUpperCase()
}

export default function AppLayout() {
  const navigate = useNavigate()
  const token = sessionStorage.getItem('aria_token') ?? ''
  const { name, email, is_admin } = decodeTokenClaims(token)
  const displayName = name ?? email ?? ''
  const initials = displayName ? getInitials(displayName) : '?'

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = () => {
    notificationsApi.getMyNotifications()
      .then(({ notifications: n, unread_count }) => {
        setNotifications(n)
        setUnreadCount(unread_count)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!bellOpen) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  const handleBellClick = () => {
    if (!bellOpen && unreadCount > 0) {
      notificationsApi.markAllRead().then(() => {
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      }).catch(() => {})
    }
    setBellOpen((o) => !o)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('aria_token')
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-app-name">
            <div className="sidebar-logo">A</div>
            Aria
          </div>
          <div className="notif-wrap" ref={bellRef}>
            <button className="btn-icon notif-bell" onClick={handleBellClick} type="button" title="Notifications">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            {bellOpen && (
              <div className="notif-dropdown">
                <div className="notif-hdr">Notifications</div>
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div className={`notif-item${n.is_read ? '' : ' unread'}`} key={n.id}>
                      {n.message}
                    </div>
                  ))
                )}
              </div>
            )}
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
          {is_admin && (
            <>
              <div className="nav-label" style={{ marginTop: 8 }}>Admin</div>
              <NavLink
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                to="/employees"
              >
                <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="16">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Employees
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-row">
            <NavLink to="/profile" className="user-profile-link">
              <div className="avatar avatar-sm">{initials}</div>
              <div className="user-info">
                <div className="user-name">{displayName || 'Unknown'}</div>
              </div>
            </NavLink>
            <button className="btn-icon logout-btn" onClick={handleLogout} title="Sign out" type="button">
              <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="15">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}
