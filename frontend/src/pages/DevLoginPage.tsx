import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const MOCK_USERS = [
  { label: 'Admin',    email: 'admin@aria.dev',    password: 'admin123',    role: 'Full access',  color: '#3C3489', bg: '#EEEDFE' },
  { label: 'Manager',  email: 'manager@aria.dev',  password: 'manager123',  role: 'Team & leave', color: '#085041', bg: '#E1F5EE' },
  { label: 'Employee', email: 'employee@aria.dev', password: 'employee123', role: 'Self-service', color: '#854F0B', bg: '#FAEEDA' },
]

export default function DevLoginPage() {
  const navigate = useNavigate()

  const loginAs = async (email: string, password: string) => {
    try {
      const { data } = await axios.post('/api/auth/login', { email, password })
      sessionStorage.setItem('aria_token', data.access_token)
      navigate('/')
    } catch (e) {
      console.error('Login failed', e)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#F1EFE8', fontFamily:'system-ui, sans-serif' }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'#854F0B', textTransform:'uppercase', marginBottom:8 }}>
        Dev mode · not visible in production
      </div>
      <div style={{ fontSize:24, fontWeight:500, color:'#1C1B19', marginBottom:4 }}>Sign in as</div>
      <div style={{ fontSize:14, color:'#5F5E5A', marginBottom:40 }}>Pick a mock user to test different permission levels</div>

      <div style={{ display:'flex', gap:16 }}>
        {MOCK_USERS.map((u) => (
          <button
            key={u.email}
            onClick={() => loginAs(u.email, u.password)}
            style={{
              width:200, padding:'24px 20px', borderRadius:16,
              border:'1px solid #D3D1C7', background:'#FFFFFF',
              cursor:'pointer', textAlign:'left', fontFamily:'inherit',
              transition:'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8F7F4')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
          >
            <div style={{ width:40, height:40, borderRadius:'50%', background:u.bg, color:u.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:600, marginBottom:14 }}>
              {u.label[0]}
            </div>
            <div style={{ fontSize:15, fontWeight:500, color:'#1C1B19', marginBottom:4 }}>{u.label}</div>
            <div style={{ fontSize:12, color:'#5F5E5A', marginBottom:14 }}>{u.role}</div>
            <div style={{ fontSize:11, color:u.color, background:u.bg, padding:'3px 8px', borderRadius:20, display:'inline-block' }}>
              {u.email}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/login')}
        style={{ marginTop:32, fontSize:12, color:'#888780', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}
      >
        ← Use the real login page
      </button>
    </div>
  )
}