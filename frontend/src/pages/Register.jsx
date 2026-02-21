import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../services/localApi'
import {
  validateEmail,
  validatePassword,
  validateRequired,
  validateMaxLen,
  validatePhoneUS,
  formatPhoneUS,
  digitsOnly,
} from '../utils/validation'

export default function Register() {
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('') // formatted string
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

  // keep digits available for validation and register payload if you want
  const phoneDigits = useMemo(() => digitsOnly(phone), [phone])

  function runValidation(next = { name, phone, email, password }) {
    const nextPhoneDigits = digitsOnly(next.phone)

    const newErrors = {
      name:
        validateRequired(next.name, 'Name') ||
        validateMaxLen(next.name, 50, 'Name'),
      phone:
        validateRequired(next.phone, 'Phone number') ||
        validatePhoneUS(nextPhoneDigits),
      email:
        validateRequired(next.email, 'Email') ||
        validateEmail(next.email),
      password:
        validateRequired(next.password, 'Password') ||
        validatePassword(next.password),
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
      // store phone as digits (clean) so it is consistent in storage
      register({
        name: name.trim(),
        phone: phoneDigits, // digits only
        email: email.trim(),
        password,
      })
      nav('/')
    } catch (e) {
      setErr(e.message || 'Registration failed. Please try again.')
    }
  }

  const canSubmit =
    name.trim() &&
    phoneDigits &&
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
          {/* name */}
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
              autoComplete="name"
            />
            {touched.name && errors.name && <div className="error-text">{errors.name}</div>}
          </div>

          {/* phone */}
          <div className="form-row">
            <label>Phone *</label>
            <input
              value={phone}
              inputMode="numeric"
              placeholder="(xxx) xxx-xxxx"
              onChange={(e) => {
                // only keep digits from typed text, then format
                const rawDigits = digitsOnly(e.target.value)
                const formatted = formatPhoneUS(rawDigits)
                setPhone(formatted)

                if (touched.phone) runValidation({ name, phone: formatted, email, password })
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, phone: true }))
                runValidation()
              }}
              className={touched.phone && errors.phone ? 'input error' : 'input'}
              autoComplete="tel"
            />
            {touched.phone && errors.phone && <div className="error-text">{errors.phone}</div>}
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

          {/* password */}
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