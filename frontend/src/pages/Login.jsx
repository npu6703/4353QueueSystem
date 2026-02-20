import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, getCurrentUser } from '../services/localApi'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const nav = useNavigate()

  // If already logged in, redirect
  const existing = getCurrentUser()
  if (existing) {
    nav(existing.isAdmin ? '/admin' : '/', { replace: true })
    return null
  }

  function submit(e) {
    e.preventDefault()
    setErr('')
    if (!email || !password) { setErr('Email and password are required'); return }
    try {
      const user = login({ email, password })
      nav(user.isAdmin ? '/admin' : '/')
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Login</h2>
        <p className="auth-subtitle">Sign in to QueueSmart</p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>Email <span className="required">*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-row">
            <label>Password <span className="required">*</span></label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={4}
            />
          </div>
          {err && <div className="form-error">{err}</div>}
          <button className="primary" type="submit" style={{ width: '100%' }}>Login</button>
        </form>
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
        <div className="auth-demo-info">
          <strong>Demo Accounts:</strong>
          <div>Admin: admin@queue.com / admin123</div>
          <div>User: user@queue.com / user123</div>
        </div>
      </div>
    </div>
  )
}
