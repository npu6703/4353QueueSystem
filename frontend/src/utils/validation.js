export function validateEmail(email) {
  if (!email || !email.trim()) return "Email is required";

  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) return "Invalid email format";

  return "";
}

export function validatePassword(password) {
  if (!password) return "Password is required";

  if (password.length < 6)
    return "Password must be at least 6 characters";

  return "";
}

export function validateRequired(value, label = "This field") {
  if (!value || !value.trim())
    return `${label} is required`;

  return "";
}

export function validateMaxLen(value, max, label = "This field") {
  if ((value || "").length > max)
    return `${label} must be at most ${max} characters`;

  return "";
}

export function validatePositiveInt(value, label = "This field") {
  if (!value)
    return `${label} is required`;

  const n = Number(value);

  if (!Number.isInteger(n))
    return `${label} must be a number`;

  if (n <= 0)
    return `${label} must be greater than 0`;

  return "";
}