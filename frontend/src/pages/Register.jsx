import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setTouched({ name: true, phone: true, email: true, password: true })

    const ok = runValidation()
    if (!ok) return

    try {
      const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phoneDigits, email: email.trim(), password, role: 'user' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Registration failed. Please try again.')
      nav('/login')
    } catch (e) {
      setErr(e.message || 'Registration failed. Please try again.')
    }
  }

  // Compute button state from raw values, not from the errors display state.
  // errors is only updated when a field is blurred (or onChange after blur),
  // so checking !errors.password would leave the button disabled while the user
  // is actively typing in the last field before it has been blurred.
  const canSubmit = useMemo(() => {
    const digits = digitsOnly(phone)
    return (
      !validateRequired(name, 'Name') &&
      !validateMaxLen(name, 50, 'Name') &&
      !validateRequired(phone, 'Phone number') &&
      !validatePhoneUS(digits) &&
      !validateRequired(email, 'Email') &&
      !validateEmail(email) &&
      !validateRequired(password, 'Password') &&
      !validatePassword(password)
    )
  }, [name, phone, email, password])

  return (
    <div className="auth-page register-page">
      <div className="auth-card register-card">
        <h2>Register</h2>
        <p className="register-subtitle">Create your QueueSmart account</p>

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