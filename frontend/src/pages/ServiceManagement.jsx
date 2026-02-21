import { useState, useEffect } from 'react'
import { getServices, saveService, deleteService } from '../services/localApi'
import {
  validateRequired,
  validateMaxLen,
  validatePositiveInt,
} from '../utils/validation'

export default function ServiceManagement() {
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState(null)

  const [errors, setErrors] = useState({
    name: '',
    description: '',
    expected: '',
    priority: '',
  })

  const [touched, setTouched] = useState({
    name: false,
    description: false,
    expected: false,
    priority: false,
  })

  useEffect(() => {
    setServices(getServices())
  }, [])

  function resetValidation() {
    setErrors({
      name: '',
      description: '',
      expected: '',
      priority: '',
    })
    setTouched({
      name: false,
      description: false,
      expected: false,
      priority: false,
    })
  }

  function startCreate() {
    setEditing({
      name: '',
      description: '',
      expected: 10,
      priority: 'low',
      open: true,
    })
    resetValidation()
  }

  function edit(service) {
    setEditing({ ...service })
    resetValidation()
  }

  function runValidation(next = editing) {
    if (!next) return false

    const newErrors = {
      name:
        validateRequired(next.name, 'Service Name') ||
        validateMaxLen(next.name, 100, 'Service Name'),
      description: validateRequired(next.description, 'Description'),
      expected: validatePositiveInt(next.expected, 'Expected Duration'),
      priority: validateRequired(next.priority, 'Priority'),
    }

    setErrors(newErrors)

    return (
      !newErrors.name &&
      !newErrors.description &&
      !newErrors.expected &&
      !newErrors.priority
    )
  }

  function save() {
    setTouched({
      name: true,
      description: true,
      expected: true,
      priority: true,
    })

    const ok = runValidation()
    if (!ok) return

    saveService(editing)
    setServices(getServices())
    setEditing(null)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0 }}>Service Management</h2>
        <button className="primary" onClick={startCreate}>+ New Service</button>
      </div>

      <table className="sm-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Duration</th>
            <th>Priority</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.length === 0 && (
            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No services yet. Create one above.</td></tr>
          )}
          {services.map(s => (
            <tr key={s.id}>
              <td><strong>{s.name}</strong></td>
              <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</td>
              <td>{s.expected} min</td>
              <td><span className={`sm-priority sm-priority-${s.priority}`}>{s.priority}</span></td>
              <td><span className={`sm-status ${s.open ? 'sm-open' : 'sm-closed'}`}>{s.open ? 'Open' : 'Closed'}</span></td>
              <td style={{ textAlign: 'right' }}>
                <button className="sm-btn sm-btn-edit" onClick={() => edit(s)}>Edit</button>
                <button className="sm-btn sm-btn-delete" onClick={() => { deleteService(s.id); setServices(getServices()) }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div style={{ marginTop: 20 }}>

          {/* Name */}
          <div className="form-row">
            <label>Service Name</label>
            <input
              value={editing.name}
              onChange={(e) => {
                const v = e.target.value
                const next = { ...editing, name: v }
                setEditing(next)
                if (touched.name) runValidation(next)
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, name: true }))
                runValidation()
              }}
              className={
                touched.name && errors.name ? 'input error' : 'input'
              }
            />
            {touched.name && errors.name && (
              <div className="error-text">{errors.name}</div>
            )}
          </div>

          {/* Description */}
          <div className="form-row">
            <label>Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => {
                const v = e.target.value
                const next = { ...editing, description: v }
                setEditing(next)
                if (touched.description) runValidation(next)
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, description: true }))
                runValidation()
              }}
              className={
                touched.description && errors.description
                  ? 'input error'
                  : 'input'
              }
            />
            {touched.description && errors.description && (
              <div className="error-text">
                {errors.description}
              </div>
            )}
          </div>

          {/* Expected */}
          <div className="form-row">
            <label>Expected Duration (minutes)</label>
            <input
              type="number"
              value={editing.expected}
              onChange={(e) => {
                const raw = e.target.value
                const val = raw === '' ? '' : Number(raw)
                const next = { ...editing, expected: val }
                setEditing(next)
                if (touched.expected) runValidation(next)
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, expected: true }))
                runValidation()
              }}
              className={
                touched.expected && errors.expected
                  ? 'input error'
                  : 'input'
              }
            />
            {touched.expected && errors.expected && (
              <div className="error-text">
                {errors.expected}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="form-row">
            <label>Priority</label>
            <select
              value={editing.priority}
              onChange={(e) => {
                const v = e.target.value
                const next = { ...editing, priority: v }
                setEditing(next)
                if (touched.priority) runValidation(next)
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, priority: true }))
                runValidation()
              }}
              className={
                touched.priority && errors.priority
                  ? 'input error'
                  : 'input'
              }
            >
              <option value="">Select</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            {touched.priority && errors.priority && (
              <div className="error-text">
                {errors.priority}
              </div>
            )}
          </div>

          {/* Open */}
          <div className="form-row">
            <label>Open</label>
            <input
              type="checkbox"
              checked={!!editing.open}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  open: e.target.checked,
                })
              }
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <button className="primary" onClick={save}>
              Save
            </button>
            <button
              style={{ marginLeft: 10 }}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}