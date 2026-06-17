import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/auth/login`,
        { email, password },
      )
      sessionStorage.setItem('aria_token', data.access_token)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">A</div>
        <h1 className="login-title">Sign in to Aria</h1>
        <p className="login-subtitle">Your AI HR assistant</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="email">Email</label>
            <input
              autoComplete="email"
              autoFocus
              className="input"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              className="input"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            className="btn btn-primary btn-lg"
            disabled={loading || !email || !password}
            style={{ width: '100%' }}
            type="submit"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <div className="login-dev">
            <Link to="/dev">Use dev quick-login →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
