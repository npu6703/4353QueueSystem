import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../services/localApi'
import {
  validateEmail,
  validatePassword,
  validateRequired,
  validateMaxLen,
} from '../utils/validation'

function formatUSPhone(raw) {
  // keep digits only
  let digits = String(raw ?? '').replace(/\D/g, '')

  // allow up to 11 digits total
  if (digits.length > 11) digits = digits.slice(0, 11)

  // if 11 digits, must start with 1. otherwise drop extra
  if (digits.length === 11 && digits[0] !== '1') {
    digits = digits.slice(0, 10)
  }

  if (!digits) return ''

  // 11 digits (1 + 10)
  if (digits.length === 11) {
    const a = digits.slice(1, 4)
    const b = digits.slice(4, 7)
    const c = digits.slice(7, 11)
    if (digits.length <= 1) return '1'
    if (digits.length <= 4) return `1 (${a}`
    if (digits.length <= 7) return `1 (${a}) ${b}`
    return `1 (${a}) ${b}-${c}`
  }

  // 10 digits
  const a = digits.slice(0, 3)
  const b = digits.slice(3, 6)
  const c = digits.slice(6, 10)

  if (digits.length <= 3) return `(${a}`
  if (digits.length <= 6) return `(${a}) ${b}`
  return `(${a}) ${b}-${c}`
}

function isValidUSPhone(formatted) {
  const digits = String(formatted ?? '').replace(/\D/g, '')
  if (digits.length === 10) return true
  if (digits.length === 11 && digits[0] === '1') return true
  return false
}

function validatePhone(value) {
  const v = String(value ?? '').trim()
  if (!v) return 'phone is required'

  if (!isValidUSPhone(v)) {
    return 'enter a valid phone: (xxx) xxx-xxxx or 1 (xxx) xxx-xxxx'
  }

  return ''
}

export default function Register() {
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    password: false,
  })

  function runValidation(
    next = { name, email, phone, password }
  ) {
    const newErrors = {
      name:
        validateRequired(next.name, 'name') ||
        validateMaxLen(next.name, 50, 'name'),
      email: validateEmail(next.email),
      phone: validatePhone(next.phone),
      password: validatePassword(next.password),
    }

    setErrors(newErrors)
    return (
      !newErrors.name &&
      !newErrors.email &&
      !newErrors.phone &&
      !newErrors.password
    )
  }

  function submit(e) {
    e.preventDefault()
    setErr('')
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
    })

    const ok = runValidation()
    if (!ok) return

    try {
      register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
        password,
      })
      nav('/login')
    } catch (e2) {
      setErr(e2.message || 'register failed')
    }
  }

  const canSubmit =
    name.trim() &&
    email.trim() &&
    phone.trim() &&
    password &&
    !errors.name &&
    !errors.email &&
    !errors.phone &&
    !errors.password

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Register</h2>
        <p>Create your QueueSmart account</p>

        <form onSubmit={submit} noValidate>
          {/* name */}
          <div className="form-row">
            <label>Name *</label>
            <input
              value={name}
              onChange={(e) => {
                const v = e.target.value
                setName(v)
                if (touched.name)
                  runValidation({ name: v, email, phone, password })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, name: true }))
                runValidation()
              }}
              className={
                touched.name && errors.name ? 'input error' : 'input'
              }
              autoComplete="name"
            />
            {touched.name && errors.name && (
              <div className="error-text">{errors.name}</div>
            )}
          </div>

          {/* email */}
          <div className="form-row">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const v = e.target.value
                setEmail(v)
                if (touched.email)
                  runValidation({ name, email: v, phone, password })
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

          {/* phone */}
          <div className="form-row">
            <label>Phone *</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => {
                const formatted = formatUSPhone(e.target.value)
                setPhone(formatted)
                if (touched.phone)
                  runValidation({
                    name,
                    email,
                    phone: formatted,
                    password,
                  })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, phone: true }))
                runValidation()
              }}
              className={
                touched.phone && errors.phone ? 'input error' : 'input'
              }
              placeholder="(555) 123-4567"
              autoComplete="tel"
            />
            {touched.phone && errors.phone && (
              <div className="error-text">{errors.phone}</div>
            )}
          </div>

          {/* password */}
          <div className="form-row">
            <label>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                const v = e.target.value
                setPassword(v)
                if (touched.password)
                  runValidation({ name, email, phone, password: v })
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
              autoComplete="new-password"
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
            Register
          </button>
        </form>

        <p style={{ marginTop: '1rem' }}>
          Already have an account?{' '}
          <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  )
}