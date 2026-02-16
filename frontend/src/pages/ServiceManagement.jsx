import { useState, useEffect } from 'react'
import { getServices, saveService } from '../services/localApi'

export default function ServiceManagement(){
  const [services,setServices]=useState([])
  const [editing,setEditing]=useState(null)

  useEffect(()=> setServices(getServices()),[])

  function startCreate(){ setEditing({name:'',description:'',expected:10,priority:'low',open:true}) }
  function edit(s){ setEditing({...s}) }
  function save(){ saveService(editing); setServices(getServices()); setEditing(null) }

  return (
    <div className="card">
      <h2>Service Management</h2>
      <button onClick={startCreate} className="primary">Create Service</button>
      <ul>
        {services.map(s=> (
          <li key={s.id}>{s.name} — <button onClick={()=>edit(s)}>Edit</button></li>
        ))}
      </ul>

      {editing && (
        <div style={{marginTop:12}}>
          <div className="form-row"><label>Name</label><input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} maxLength={100} required /></div>
          <div className="form-row"><label>Description</label><textarea value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})} required /></div>
          <div className="form-row"><label>Expected (min)</label><input type="number" value={editing.expected} onChange={e=>setEditing({...editing,expected:parseInt(e.target.value||0)})} required /></div>
          <div className="form-row"><label>Priority</label>
            <select value={editing.priority} onChange={e=>setEditing({...editing,priority:e.target.value})}><option>low</option><option>medium</option><option>high</option></select>
          </div>
          <div className="form-row"><label>Open</label><input type="checkbox" checked={editing.open} onChange={e=>setEditing({...editing,open:e.target.checked})} /></div>
          <div>
            <button className="primary" onClick={save}>Save</button>
            <button onClick={()=>setEditing(null)} style={{marginLeft:8}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
