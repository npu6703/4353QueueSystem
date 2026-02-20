import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/localApi'
import { validateEmail, validatePassword } from '../utils/validation'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({ email: false, password: false })
  const [err, setErr] = useState('')
  const nav = useNavigate()

  function runValidation(nextEmail = email, nextPassword = password){
    const newErrors = {
      email: validateEmail(nextEmail),
      password: validatePassword(nextPassword),
    }
    setErrors(newErrors)
    return !newErrors.email && !newErrors.password
  }

  async function submit(e){
    e.preventDefault()
    setErr('')
    setTouched({ email: true, password: true })

    const ok = runValidation()
    if(!ok) return

    try{
      login({ email: email.trim(), password })
      nav('/')
    }catch(e){
      setErr(e.message || 'Login failed')
    }
  }

  const canSubmit =
    email.trim() &&
    password &&
    !errors.email &&
    !errors.password

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={submit} noValidate>

        <div className="form-row">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e)=>{
              const v = e.target.value
              setEmail(v)
              if(touched.email) runValidation(v, password)
            }}
            onBlur={()=>{
              setTouched(t=>({ ...t, email: true }))
              runValidation(email, password)
            }}
            className={touched.email && errors.email ? 'input error' : 'input'}
            autoComplete="email"
          />
          {touched.email && errors.email && <div className="error-text">{errors.email}</div>}
        </div>

        <div className="form-row">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e)=>{
              const v = e.target.value
              setPassword(v)
              if(touched.password) runValidation(email, v)
            }}
            onBlur={()=>{
              setTouched(t=>({ ...t, password: true }))
              runValidation(email, password)
            }}
            className={touched.password && errors.password ? 'input error' : 'input'}
            autoComplete="current-password"
          />
          {touched.password && errors.password && <div className="error-text">{errors.password}</div>}
        </div>

        {err && <div className="error-text">{err}</div>}

        <button className="primary" type="submit" disabled={!canSubmit}>
          Login
        </button>
      </form>
    </div>
  )
}