export function validateRequired(value, label = 'Field') {
  const v = String(value ?? '').trim()
  if (!v) return `${label} is required`
  return ''
}

export function validateMaxLen(value, max, label = 'Field') {
  const v = String(value ?? '')
  if (v.length > max) return `${label} must be ${max} characters or less`
  return ''
}

export function validateEmail(email) {
  const v = String(email ?? '').trim()
  if (!v) return 'Email is required'
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  if (!ok) return 'Invalid email format'
  return ''
}

export function validatePassword(pw) {
  const v = String(pw ?? '')
  if (!v) return 'Password is required'
  if (v.length < 6) return 'Password must be at least 6 characters'
  return ''
}

export function validatePositiveInt(value, label = 'Field') {
  if (value === '' || value === null || value === undefined) return `${label} is required`
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return `${label} must be a positive whole number`
  return ''
}

export function validatePhone(phone, label = 'Phone') {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return `${label} is required`

  if (digits.length === 10) return ''

  if (digits.length === 11) {
    if (digits[0] !== '1') return `${label} 11 digit numbers must start with 1`
    return ''
  }

  return `${label} must be 10 digits or 11 digits starting with 1`
}