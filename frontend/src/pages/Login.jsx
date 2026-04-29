import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validateEmail, validatePassword } from '../utils/validation'
import { API_BASE } from '../config'
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [errors, setErrors] = useState({
    email: '',
    password: '',
  })

  const [touched, setTouched] = useState({
    email: false,
    password: false,
  })

  function runValidation(next = { email, password }) {
    const newErrors = {
      email: validateEmail(next.email),
      password: validatePassword(next.password),
    }

    setErrors(newErrors)
    return !newErrors.email && !newErrors.password
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setTouched({ email: true, password: true })

    const ok = runValidation()
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.message || 'Sign in failed')
      }

      sessionStorage.setItem('qs_current', JSON.stringify(json.data))

      if (json.data.isAdmin) nav('/admin')
      else nav('/')
    } catch (e) {
      setErr(e.message || 'Sign in failed')
    }
  }

  const canSubmit = !validateEmail(email) && !validatePassword(password)

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">
          <User size={36} />
        </div>

        <h2>Welcome back</h2>
        <p className="auth-subtitle">Sign in to your QueueSmart account</p>

        <form onSubmit={submit} noValidate>
          <div className="form-row">
            <label>Email *</label>

            <div className="input-wrap">
              <Mail className="field-icon" size={20} />
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  const v = e.target.value
                  setEmail(v)
                  if (touched.email) runValidation({ email: v, password })
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, email: true }))
                  runValidation()
                }}
                className={touched.email && errors.email ? 'input error' : 'input'}
                autoComplete="email"
              />
            </div>

            {touched.email && errors.email && (
              <div className="error-text">{errors.email}</div>
            )}
          </div>

          <div className="form-row">
            <label>Password *</label>

            <div className="input-wrap">
              <Lock className="field-icon" size={20} />

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  const v = e.target.value
                  setPassword(v)
                  if (touched.password) runValidation({ email, password: v })
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, password: true }))
                  runValidation()
                }}
                className={touched.password && errors.password ? 'input error' : 'input'}
                autoComplete="current-password"
              />

              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {touched.password && errors.password && (
              <div className="error-text">{errors.password}</div>
            )}
          </div>

          {err && <div className="error-text">{err}</div>}

          <button className="primary" type="submit" disabled={!canSubmit}>
            Sign in
          </button>
        </form>

        <p className="register-link">
          New here? <a href="/register">Create an account</a>
        </p>
      </div>
    </div>
  )
}