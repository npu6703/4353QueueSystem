// =============================
// BASIC VALIDATION HELPERS
// =============================

export function validateRequired(value, label = 'Field') {
  if (!String(value || '').trim()) {
    return `${label} is required.`
  }
  return ''
}

export function validateMaxLen(value, max, label = 'Field') {
  if (String(value || '').length > max) {
    return `${label} must not exceed ${max} characters.`
  }
  return ''
}

// =============================
// EMAIL VALIDATION
// =============================

export function validateEmail(email) {
  const value = String(email || '').trim()

  if (!value) return 'Email is required.'

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!regex.test(value)) {
    return 'Please enter a valid email address.'
  }

  return ''
}

// =============================
// PASSWORD VALIDATION
// =============================

export function validatePassword(password) {
  const value = String(password || '')

  if (!value) return 'Password is required.'

  if (value.length < 8) {
    return 'Password must be at least 8 characters long.'
  }

  return ''
}

// =============================
// PHONE HELPERS
// =============================

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

// formats: (xxx) xxx-xxxx
// accepts up to 11 digits (leading 1)
export function formatPhoneUS(value) {
  let d = digitsOnly(value).slice(0, 11)

  // if 11 digits but not starting with 1, trim to 10
  if (d.length === 11 && d[0] !== '1') {
    d = d.slice(0, 10)
  }

  if (d.length === 0) return ''

  if (d.length <= 3) {
    return `(${d}`
  }

  if (d.length <= 6) {
    return `(${d.slice(0, 3)}) ${d.slice(3)}`
  }

  if (d.length <= 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  // 11 digits starting with 1
  return `1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
}

// =============================
// PHONE VALIDATION
// =============================

export function validatePhoneUS(phone) {
  const digits = digitsOnly(phone)

  if (!digits) {
    return 'Phone number is required.'
  }

  if (digits.length === 10) {
    return ''
  }

  if (digits.length === 11) {
    if (!digits.startsWith('1')) {
      return 'Phone number must start with 1 when using 11 digits.'
    }
    return ''
  }

  return 'Phone number must contain 10 digits or 11 digits starting with 1.'
}

export function validatePositiveInt(value, label = 'Value') {
  const num = Number(value)

  if (!value) return `${label} is required.`
  if (!Number.isInteger(num) || num <= 0) {
    return `${label} must be a positive integer.`
  }

  return ''
}