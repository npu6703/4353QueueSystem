import { useState, useEffect } from 'react'
import { getCurrentUser, getUserQueueStatus, getServices, getQueueForService } from '../services/localApi'

export default function QueueStatus(){
  const [services,setServices]=useState([])
  const user = getCurrentUser()
  useEffect(()=>{ setServices(getServices()) },[])
  const status = user ? getUserQueueStatus(user.id) : null

  function estWait(){
    if(!status) return ''
    const svc = services.find(s=>s.id===status.serviceId)
    const q = getQueueForService(status.serviceId)
    const minutes = (status.position) * (svc?.expected || 10)
    return `${minutes} minutes (est)`
  }

  return (
    <div className="card">
      <h2>Queue Status</h2>
      {status ? (
        <div>
          <div>Service: {status.serviceId}</div>
          <div>Position: {status.position}</div>
          <div>Estimated wait: {estWait()}</div>
          <div>Status: {status.position===1? 'Almost ready':'Waiting'}</div>
        </div>
      ) : (
        <div>You're not in a queue.</div>
      )}
    </div>
  )
}
