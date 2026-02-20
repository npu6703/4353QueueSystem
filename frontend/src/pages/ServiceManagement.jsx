import { useState, useEffect } from 'react'
import { getServices, saveService, deleteService } from '../services/localApi'
import '../styles/AdminDashboard.css'

const EMPTY_FORM = { name: '', description: '', expected: '', priority: 'low', open: true }

export default function ServiceManagement() {
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState(null) // null = closed, object = form data
  const [errors, setErrors] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { setServices(getServices()) }, [])

  function refresh() { setServices(getServices()) }

  function startCreate() {
    setEditing({ ...EMPTY_FORM })
    setErrors({})
  }

  function startEdit(svc) {
    setEditing({ ...svc })
    setErrors({})
  }

  function cancelEdit() {
    setEditing(null)
    setErrors({})
  }

  function validate() {
    const errs = {}
    if (!editing.name.trim()) errs.name = 'Service name is required'
    else if (editing.name.trim().length > 100) errs.name = 'Service name must be 100 characters or less'
    if (!editing.description.trim()) errs.description = 'Description is required'
    const dur = parseInt(editing.expected)
    if (!editing.expected && editing.expected !== 0) errs.expected = 'Expected duration is required'
    else if (isNaN(dur) || dur < 1) errs.expected = 'Duration must be at least 1 minute'
    else if (dur > 480) errs.expected = 'Duration cannot exceed 480 minutes'
    return errs
  }

  function save() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const toSave = {
      ...editing,
      name: editing.name.trim(),
      description: editing.description.trim(),
      expected: parseInt(editing.expected)
    }
    saveService(toSave)
    refresh()
    setEditing(null)
    setErrors({})
  }

  function handleDelete(svc) {
    setConfirmDelete(svc.id)
  }

  function confirmDeleteService(id) {
    deleteService(id)
    refresh()
    setConfirmDelete(null)
    if (editing && editing.id === id) setEditing(null)
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h2>Service Management</h2>
          <p className="admin-subtitle">Create, edit, and manage your services</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          + Create Service
        </button>
      </div>

      {/* Service Form (Create / Edit) */}
      {editing && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{editing.id ? 'Edit Service' : 'Create New Service'}</h3>
          <div className="svc-form-grid">
            <div className="form-row">
              <label>Service Name <span className="required">*</span></label>
              <input
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. General Advising"
                maxLength={100}
                required
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
              <span className="field-hint">{editing.name.length}/100 characters</span>
            </div>

            <div className="form-row">
              <label>Description <span className="required">*</span></label>
              <textarea
                value={editing.description}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                placeholder="Describe what this service provides"
                rows={3}
                required
              />
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>

            <div className="svc-form-row-inline">
              <div className="form-row">
                <label>Expected Duration (minutes) <span className="required">*</span></label>
                <input
                  type="number"
                  value={editing.expected}
                  onChange={e => setEditing({ ...editing, expected: e.target.value })}
                  placeholder="e.g. 15"
                  min={1}
                  max={480}
                  required
                />
                {errors.expected && <span className="field-error">{errors.expected}</span>}
              </div>

              <div className="form-row">
                <label>Priority Level <span className="required">*</span></label>
                <select value={editing.priority} onChange={e => setEditing({ ...editing, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-row">
                <label>Status</label>
                <div className="svc-toggle-wrapper">
                  <label className="svc-toggle">
                    <input
                      type="checkbox"
                      checked={editing.open}
                      onChange={e => setEditing({ ...editing, open: e.target.checked })}
                    />
                    <span className="svc-toggle-slider"></span>
                  </label>
                  <span className={editing.open ? 'svc-toggle-label open' : 'svc-toggle-label closed'}>
                    {editing.open ? 'Open' : 'Closed'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="svc-form-actions">
            <button className="admin-btn admin-btn-primary" onClick={save}>
              {editing.id ? 'Update Service' : 'Create Service'}
            </button>
            <button className="admin-btn admin-btn-outline" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* Services Table */}
      <div className="admin-table-wrapper">
        <h3 className="admin-table-title">All Services ({services.length})</h3>
        {services.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No services yet. Click "Create Service" to add one.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Description</th>
                <th>Duration</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td className="service-name">{s.name}</td>
                  <td className="service-desc">{s.description}</td>
                  <td>{s.expected} min</td>
                  <td>
                    <span className={`priority-badge priority-${s.priority}`}>{s.priority}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${s.open ? 'status-open' : 'status-closed'}`}>
                      {s.open ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td>
                    <div className="svc-action-btns">
                      <button className="admin-btn admin-btn-outline" onClick={() => startEdit(s)}>Edit</button>
                      {confirmDelete === s.id ? (
                        <>
                          <button className="admin-btn admin-btn-danger" onClick={() => confirmDeleteService(s.id)}>Confirm</button>
                          <button className="admin-btn admin-btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(s)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
