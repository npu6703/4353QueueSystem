import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register, getCurrentUser } from '../services/localApi'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
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
    if (!name || !email || !password) { setErr('All fields are required'); return }
    if (name.length > 100) { setErr('Name must be 100 characters or less'); return }
    if (password.length < 4) { setErr('Password must be at least 4 characters'); return }
    try {
      const user = register({ email, password, name, isAdmin: role === 'admin' })
      nav(user.isAdmin ? '/admin' : '/')
    } catch (e) { setErr(e.message) }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Register</h2>
        <p className="auth-subtitle">Create your QueueSmart account</p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>Full Name <span className="required">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              maxLength={100}
            />
          </div>
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
              placeholder="At least 4 characters"
              required
              minLength={4}
            />
          </div>
          <div className="form-row">
            <label>Role <span className="required">*</span></label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          {err && <div className="form-error">{err}</div>}
          <button className="primary" type="submit" style={{ width: '100%' }}>Create Account</button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  )
}
