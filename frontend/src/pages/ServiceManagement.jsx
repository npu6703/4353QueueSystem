import { useState, useEffect } from 'react'
import { getServices, saveService } from '../services/localApi'
import { validateRequired, validateMaxLen, validatePositiveInt } from '../utils/validation'

export default function ServiceManagement(){
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState(null)

  const [errors, setErrors] = useState({ name: '', description: '', expected: '', priority: '' })
  const [touched, setTouched] = useState({ name: false, description: false, expected: false, priority: false })

  useEffect(()=> setServices(getServices()),[])

  function startCreate(){
    setEditing({ name:'', description:'', expected:10, priority:'low', open:true })
    setErrors({ name:'', description:'', expected:'', priority:'' })
    setTouched({ name:false, description:false, expected:false, priority:false })
  }

  function edit(s){
    setEditing({ ...s })
    setErrors({ name:'', description:'', expected:'', priority:'' })
    setTouched({ name:false, description:false, expected:false, priority:false })
  }

  function runValidation(next = editing){
    if(!next) return false

    const newErrors = {
      name: validateMaxLen(next.name, 100, 'Service Name') || validateRequired(next.name, 'Service Name'),
      description: validateRequired(next.description, 'Description'),
      expected: validatePositiveInt(next.expected, 'Expected Duration'),
      priority: validateRequired(next.priority, 'Priority'),
    }

    setErrors(newErrors)
    return !newErrors.name && !newErrors.description && !newErrors.expected && !newErrors.priority
  }

  function save(){
    setTouched({ name:true, description:true, expected:true, priority:true })

    const ok = runValidation()
    if(!ok) return

    saveService(editing)
    setServices(getServices())
    setEditing(null)
  }

  return (
    <div className="card">
      <h2>Service Management</h2>

      <button onClick={startCreate} className="primary">Create Service</button>

      <ul>
        {services.map(s=> (
          <li key={s.id}>
            {s.name} — <button onClick={()=>edit(s)}>Edit</button>
          </li>
        ))}
      </ul>

      {editing && (
        <div style={{ marginTop: 12 }}>
          <div className="form-row">
            <label>Service Name</label>
            <input
              value={editing.name}
              onChange={e=>{
                const v = e.target.value
                const next = { ...editing, name: v }
                setEditing(next)
                if(touched.name) runValidation(next)
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
            <label>Description</label>
            <textarea
              value={editing.description}
              onChange={e=>{
                const v = e.target.value
                const next = { ...editing, description: v }
                setEditing(next)
                if(touched.description) runValidation(next)
              }}
              onBlur={()=>{
                setTouched(t=>({ ...t, description: true }))
                runValidation()
              }}
              className={touched.description && errors.description ? 'input error' : 'input'}
            />
            {touched.description && errors.description && <div className="error-text">{errors.description}</div>}
          </div>

          <div className="form-row">
            <label>Expected Duration (minutes)</label>
            <input
              type="number"
              value={editing.expected}
              onChange={e=>{
                const raw = e.target.value
                const val = raw === '' ? '' : Number(raw)
                const next = { ...editing, expected: val }
                setEditing(next)
                if(touched.expected) runValidation(next)
              }}
              onBlur={()=>{
                setTouched(t=>({ ...t, expected: true }))
                runValidation()
              }}
              className={touched.expected && errors.expected ? 'input error' : 'input'}
            />
            {touched.expected && errors.expected && <div className="error-text">{errors.expected}</div>}
          </div>

          <div className="form-row">
            <label>Priority</label>
            <select
              value={editing.priority}
              onChange={e=>{
                const v = e.target.value
                const next = { ...editing, priority: v }
                setEditing(next)
                if(touched.priority) runValidation(next)
              }}
              onBlur={()=>{
                setTouched(t=>({ ...t, priority: true }))
                runValidation()
              }}
              className={touched.priority && errors.priority ? 'input error' : 'input'}
            >
              <option value="">Select</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            {touched.priority && errors.priority && <div className="error-text">{errors.priority}</div>}
          </div>

          <div className="form-row">
            <label>Open</label>
            <input
              type="checkbox"
              checked={!!editing.open}
              onChange={e=>setEditing({ ...editing, open: e.target.checked })}
            />
          </div>

          <div>
            <button className="primary" onClick={save}>Save</button>
            <button onClick={()=>setEditing(null)} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}