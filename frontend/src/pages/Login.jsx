import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/localApi'

export default function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [err,setErr]=useState('')
  const nav = useNavigate()

  async function submit(e){
    e.preventDefault()
    setErr('')
    if(!email||!password){ setErr('Email and password are required'); return }
    try{
      login({email,password})
      nav('/')
    }catch(e){ setErr(e.message) }
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={4} />
        </div>
        {err && <div style={{color:'red'}}>{err}</div>}
        <button className="primary" type="submit">Login</button>
      </form>
    </div>
  )
}
