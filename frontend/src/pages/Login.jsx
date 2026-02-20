import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/localApi'
import { validateEmail, validatePassword } from '../utils/validation'

export default function Login() {
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

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

  function submit(e) {
    e.preventDefault()
    setErr('')
    setTouched({ email: true, password: true })

    const ok = runValidation()
    if (!ok) return

    try {
      const user = login({
        email: email.trim(),
        password,
      })

      if (user.isAdmin) {
        nav('/admin')
      } else {
        nav('/')
      }
    } catch (e) {
      setErr(e.message || 'Login failed')
    }
  }

  const canSubmit =
    email.trim() &&
    password &&
    !errors.email &&
    !errors.password

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Login</h2>
        <p>Sign in to your QueueSmart account</p>

        <form onSubmit={submit} noValidate>
          <div className="form-row">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const v = e.target.value
                setEmail(v)
                if (touched.email)
                  runValidation({ email: v, password })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, email: true }))
                runValidation()
              }}
              className={
                touched.email && errors.email ? 'input error' : 'input'
              }
              autoComplete="email"
            />
            {touched.email && errors.email && (
              <div className="error-text">{errors.email}</div>
            )}
          </div>

          <div className="form-row">
            <label>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                const v = e.target.value
                setPassword(v)
                if (touched.password)
                  runValidation({ email, password: v })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, password: true }))
                runValidation()
              }}
              className={
                touched.password && errors.password
                  ? 'input error'
                  : 'input'
              }
              autoComplete="current-password"
            />
            {touched.password && errors.password && (
              <div className="error-text">{errors.password}</div>
            )}
          </div>

          {err && <div className="error-text">{err}</div>}

          <button
            className="primary"
            type="submit"
            disabled={!canSubmit}
          >
            Login
          </button>
        </form>

        <p style={{ marginTop: '1rem' }}>
          Don't have an account?{' '}
          <a href="/register">Register here</a>
        </p>
      </div>
    </div>
  )
}