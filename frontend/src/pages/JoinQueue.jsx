import { useState, useEffect } from 'react'
import { getServices, joinQueue, leaveQueue, getCurrentUser, getQueueForService } from '../services/localApi'

export default function JoinQueue(){
  const [services,setServices]=useState([])
  const [svc,setSvc]=useState('')
  const user = getCurrentUser()

  useEffect(()=>{ setServices(getServices()) },[])

  function handleJoin(){
    if(!svc) return alert('Select a service')
    joinQueue(svc, user.id)
    alert('Joined')
  }

  function handleLeave(){
    if(!svc) return alert('Select a service')
    leaveQueue(svc, user.id)
    alert('Left')
  }

  function estWait(id){
    const q=getQueueForService(id)
    const pos = q.indexOf(user.id)
    const svc = services.find(s => s.id===id)
    if(pos<0) return 'Not in queue'
    const minutes = (pos+1) * (svc?.expected||10)
    return `${minutes} minutes (est)`
  }

  return (
    <div className="card">
      <h2>Join Queue</h2>
      <div className="form-row">
        <label>Service</label>
        <select value={svc} onChange={e=>setSvc(e.target.value)}>
          <option value="">-- select --</option>
          {services.map(s=> <option key={s.id} value={s.id}>{s.name} ({s.open? 'Open':'Closed'})</option>)}
        </select>
      </div>
      {svc && <div>Estimated wait: {estWait(svc)}</div>}
      <div style={{marginTop:8}}>
        <button className="primary" onClick={handleJoin}>Join</button>
        <button style={{marginLeft:8}} onClick={handleLeave}>Leave</button>
      </div>
    </div>
  )
}
