import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../services/localApi'

export default function Register(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [name,setName]=useState('')
  const [err,setErr]=useState('')
  const nav = useNavigate()

  function submit(e){
    e.preventDefault()
    setErr('')
    if(!email||!password||!name){ setErr('All fields required'); return }
    if(password.length<4){ setErr('Password too short'); return }
    try{
      register({email,password,name})
      nav('/')
    }catch(e){ setErr(e.message) }
  }

  return (
    <div className="card">
      <h2>Register</h2>
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} required maxLength={100} />
        </div>
        <div className="form-row">
          <label>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={4} />
        </div>
        {err && <div style={{color:'red'}}>{err}</div>}
        <button className="primary" type="submit">Register</button>
      </form>
    </div>
  )
}
