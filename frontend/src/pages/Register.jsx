import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../services/localApi'
import { validateEmail, validatePassword, validateRequired, validateMaxLen } from '../utils/validation'

export default function Register(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [errors, setErrors] = useState({ name: '', email: '', password: '' })
  const [touched, setTouched] = useState({ name: false, email: false, password: false })
  const [err, setErr] = useState('')

  const nav = useNavigate()

  function runValidation(next = { name, email, password }){
    const newErrors = {
      name: validateMaxLen(next.name, 100, 'Name') || validateRequired(next.name, 'Name'),
      email: validateEmail(next.email),
      password: validatePassword(next.password),
    }
    setErrors(newErrors)
    return !newErrors.name && !newErrors.email && !newErrors.password
  }

  function submit(e){
    e.preventDefault()
    setErr('')
    setTouched({ name: true, email: true, password: true })

    const ok = runValidation()
    if(!ok) return

    try{
      register({ name: name.trim(), email: email.trim(), password })
      nav('/')
    }catch(e){
      setErr(e.message || 'Register failed')
    }
  }

  const canSubmit =
    name.trim() &&
    email.trim() &&
    password &&
    !errors.name &&
    !errors.email &&
    !errors.password

  return (
    <div className="card">
      <h2>Register</h2>

      <form onSubmit={submit} noValidate>
        <div className="form-row">
          <label>Name</label>
          <input
            value={name}
            onChange={e=>{
              const v = e.target.value
              setName(v)
              if(touched.name) runValidation({ name: v, email, password })
            }}
            onBlur={()=>{
              setTouched(t=>({ ...t, name: true }))
              runValidation()
            }}
            className={touched.name && errors.name ? 'input error' : 'input'}
          />
          {touched.name && errors.name && <div className="error-text">{errors.name}</div>}
        </div>

        <div className="form-row">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e=>{
              const v = e.target.value
              setEmail(v)
              if(touched.email) runValidation({ name, email: v, password })
            }}
            onBlur={()=>{
              setTouched(t=>({ ...t, email: true }))
              runValidation()
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
            onChange={e=>{
              const v = e.target.value
              setPassword(v)
              if(touched.password) runValidation({ name, email, password: v })
            }}
            onBlur={()=>{
              setTouched(t=>({ ...t, password: true }))
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
    </div>
  )
}