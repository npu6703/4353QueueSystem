import { useState, useEffect } from 'react'
import { getServices, getQueueForService, serveNext } from '../services/localApi'

export default function QueueManagement(){
  const [services,setServices]=useState([])
  useEffect(()=> setServices(getServices()),[])

  function handleServe(sid){
    const next = serveNext(sid)
    alert(next ? `Served ${next}` : 'No one in queue')
    setServices(getServices())
  }

  return (
    <div className="card">
      <h2>Queue Management (UI Simulation)</h2>
      {services.map(s=> (
        <div key={s.id} style={{borderBottom:'1px solid #eee',padding:8}}>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <div>{s.name} — queue length: {getQueueForService(s.id).length}</div>
            <div>
              <button onClick={()=>handleServe(s.id)} className="primary">Serve Next</button>
            </div>
          </div>
          <div style={{marginTop:6}}>
            <small>{s.description}</small>
          </div>
        </div>
      ))}
    </div>
  )
}
