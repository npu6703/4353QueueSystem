import { useState, useEffect } from 'react'
import { getCurrentUser, getServices, getUserQueueStatus } from '../services/localApi'

export default function UserDashboard(){
  const [services,setServices]=useState([])
  const user = getCurrentUser()

  useEffect(()=>{ setServices(getServices()) },[])

  const status = user ? getUserQueueStatus(user.id) : null

  return (
    <div className="card">
      <h2>Welcome{user?(', '+user.name):''}</h2>
      <p>Overview</p>
      <div>
        <strong>Active services:</strong>
        <ul>
          {services.map(s=> <li key={s.id}>{s.name} — {s.open? 'Open':'Closed'}</li>)}
        </ul>
      </div>
      <div>
        <strong>Queue status:</strong>
        <div>{status ? `In ${status.serviceId}, position ${status.position}` : 'Not in queue'}</div>
      </div>
    </div>
  )
}
