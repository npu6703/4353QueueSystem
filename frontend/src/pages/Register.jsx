import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../services/localApi'
import { validateEmail, validatePassword, validateMaxLen, validateRequired, validatePhone } from '../utils/validation'

function formatUSPhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length > 11) digits = digits.slice(0, 11)

  if (digits.length === 11 && digits[0] !== '1') {
    digits = digits.slice(0, 10)
  }

  if (!digits) return ''

  if (digits.length >= 11) {
    const a = digits.slice(1, 4)
    const b = digits.slice(4, 7)
    const c = digits.slice(7, 11)
    return `1 (${a}) ${b}-${c}`
  }

  const a = digits.slice(0, 3)
  const b = digits.slice(3, 6)
  const c = digits.slice(6, 10)

  if (digits.length <= 3) return `(${a}`
  if (digits.length <= 6) return `(${a}) ${b}`
  return `(${a}) ${b}-${c}`
}

export default function Register() {
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [err, setErr] = useState('')

  const [errors, setErrors] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  })

  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    password: false,
  })

  function runValidation(next = { name, phone, email, password }) {
    const newErrors = {
      name: validateRequired(next.name, 'Name') || validateMaxLen(next.name, 100, 'Name'),
      phone: validatePhone(next.phone, 'Phone'),
      email: validateEmail(next.email),
      password: validatePassword(next.password),
    }
    setErrors(newErrors)
    return !newErrors.name && !newErrors.phone && !newErrors.email && !newErrors.password
  }

  function submit(e) {
    e.preventDefault()
    setErr('')
    setTouched({ name: true, phone: true, email: true, password: true })

    const ok = runValidation()
    if (!ok) return

    try {
      const phoneDigits = phone.replace(/\D/g, '')

      const user = register({
        name: name.trim(),
        phone: phoneDigits,
        email: email.trim(),
        password,
      })

      if (user.isAdmin) nav('/admin')
      else nav('/')
    } catch (e) {
      setErr(e.message || 'Register failed')
    }
  }

  const canSubmit =
    name.trim() &&
    phone.replace(/\D/g, '') &&
    email.trim() &&
    password &&
    !errors.name &&
    !errors.phone &&
    !errors.email &&
    !errors.password

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Register</h2>
        <p>Create your QueueSmart account</p>

        <form onSubmit={submit} noValidate>
          <div className="form-row">
            <label>Name *</label>
            <input
              value={name}
              onChange={(e) => {
                const v = e.target.value
                setName(v)
                if (touched.name) runValidation({ name: v, phone, email, password })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, name: true }))
                runValidation()
              }}
              className={touched.name && errors.name ? 'input error' : 'input'}
              maxLength={100}
              autoComplete="name"
            />
            {touched.name && errors.name && <div className="error-text">{errors.name}</div>}
          </div>

          <div className="form-row">
            <label>Phone *</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => {
                const formatted = formatUSPhone(e.target.value)
                setPhone(formatted)
                if (touched.phone) runValidation({ name, phone: formatted, email, password })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, phone: true }))
                runValidation()
              }}
              className={touched.phone && errors.phone ? 'input error' : 'input'}
              placeholder="(555) 123-4567"
              autoComplete="tel"
            />
            {touched.phone && errors.phone && <div className="error-text">{errors.phone}</div>}
          </div>

          <div className="form-row">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const v = e.target.value
                setEmail(v)
                if (touched.email) runValidation({ name, phone, email: v, password })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, email: true }))
                runValidation()
              }}
              className={touched.email && errors.email ? 'input error' : 'input'}
              autoComplete="email"
            />
            {touched.email && errors.email && <div className="error-text">{errors.email}</div>}
          </div>

          <div className="form-row">
            <label>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                const v = e.target.value
                setPassword(v)
                if (touched.password) runValidation({ name, phone, email, password: v })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, password: true }))
                runValidation()
              }}
              className={touched.password && errors.password ? 'input error' : 'input'}
              autoComplete="new-password"
            />
            {touched.password && errors.password && <div className="error-text">{errors.password}</div>}
          </div>

          {err && <div className="error-text">{err}</div>}

          <button className="primary" type="submit" disabled={!canSubmit}>
            Register
          </button>
        </form>

        <p style={{ marginTop: '1rem' }}>
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  )
}