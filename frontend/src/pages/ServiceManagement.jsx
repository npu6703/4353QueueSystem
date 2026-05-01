import { useState, useEffect } from 'react'
import { getServices, createService, updateService, deleteService } from '../services/adminApi'
import {
  validateRequired,
  validateMaxLen,
  validatePositiveInt,
} from '../utils/validation'
import '../styles/ServiceManagement.css'

const EMPTY_FORM = { name: '', description: '', expected: 10, priority: 'low', open: true }
const EMPTY_ERRORS = { name: '', description: '', expected: '', priority: '' }
const EMPTY_TOUCHED = { name: false, description: false, expected: false, priority: false }

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, stroke: 'var(--green-dark)' }}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

export default function ServiceManagement() {
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState(null)
  const [apiError, setApiError] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [errors, setErrors] = useState(EMPTY_ERRORS)
  const [touched, setTouched] = useState(EMPTY_TOUCHED)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getServices().then(setServices).catch(() => setApiError('Could not load services. Is the server running?'))
  }, [])

  function resetValidation() {
    setErrors(EMPTY_ERRORS)
    setTouched(EMPTY_TOUCHED)
    setApiError('')
  }

  function startCreate() {
    setEditing({ ...EMPTY_FORM })
    resetValidation()
  }

  function startEdit(service) {
    setEditing({ ...service })
    resetValidation()
  }

  function runValidation(next = editing) {
    if (!next) return false
    const newErrors = {
      name: validateRequired(next.name, 'Service Name') || validateMaxLen(next.name, 100, 'Service Name'),
      description: validateRequired(next.description, 'Description'),
      expected: validatePositiveInt(next.expected, 'Expected Duration'),
      priority: validateRequired(next.priority, 'Priority'),
    }
    setErrors(newErrors)
    return !newErrors.name && !newErrors.description && !newErrors.expected && !newErrors.priority
  }

  async function save() {
    setTouched({ name: true, description: true, expected: true, priority: true })
    if (!runValidation()) return
    setSaving(true)
    try {
      if (editing.id) {
        await updateService(editing.id, editing)
      } else {
        await createService(editing)
      }
      setServices(await getServices())
      setEditing(null)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    try {
      await deleteService(deleteId)
      setServices(await getServices())
      setDeleteId(null)
    } catch (err) {
      setApiError(err.message)
      setDeleteId(null)
    }
  }

  function fieldClass(field) {
    return touched[field] && errors[field] ? 'svm-err' : ''
  }

  const openCount = services.filter(s => s.open).length
  const closedCount = services.length - openCount

  return (
    <div className="svm-page">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="svm-title">Service Management</h2>
          <p className="svm-subtitle">Configure services and their queue settings</p>
        </div>
        <button className="primary" style={{ width: 'auto', height: 'auto', flexShrink: 0, padding: '0.65rem 1.4rem', fontSize: '0.92rem' }} onClick={startCreate}>+ New Service</button>
      </div>

      {apiError && !editing && <div className="form-error">{apiError}</div>}

      {/* Stats */}
      <div className="svm-stats">
        <div className="svm-stat">
          <div className="svm-stat-header">
            <span className="svm-stat-title">Total Services</span>
          </div>
          <div className="svm-stat-body">
            <span className="svm-stat-number">{services.length}</span>
            <span className="svm-stat-label">services configured</span>
          </div>
        </div>
        <div className="svm-stat svm-stat-open">
          <div className="svm-stat-header">
            <span className="svm-stat-title">Open</span>
            <span className="sm-status sm-open">Open</span>
          </div>
          <div className="svm-stat-body">
            <span className="svm-stat-number">{openCount}</span>
            <span className="svm-stat-label">accepting customers</span>
          </div>
        </div>
        <div className="svm-stat svm-stat-closed">
          <div className="svm-stat-header">
            <span className="svm-stat-title">Closed</span>
            <span className="sm-status sm-closed">Closed</span>
          </div>
          <div className="svm-stat-body">
            <span className="svm-stat-number">{closedCount}</span>
            <span className="svm-stat-label">not accepting</span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {services.length === 0 ? (
        <div className="svm-empty">
          <div className="svm-empty-icon"><FolderIcon /></div>
          <h3>No services yet</h3>
          <p>Create your first service to start managing queues.</p>
          <button className="primary" onClick={startCreate}>+ New Service</button>
        </div>
      ) : (
        <div className="svm-grid">
          {services.map(s => (
            <div key={s.id} className="svm-card">
              <div className="svm-card-accent" />
              <div className="svm-card-body">
                <div className="svm-card-header">
                  <h3 className="svm-card-name">{s.name}</h3>
                  <span className={`sm-status ${s.open ? 'sm-open' : 'sm-closed'}`}>
                    {s.open ? 'Open' : 'Closed'}
                  </span>
                </div>
                <p className="svm-card-desc">{s.description}</p>
                <div className="svm-card-meta">
                  <span className={`sm-priority sm-priority-${s.priority}`}>{s.priority}</span>
                  <span className="svm-card-duration">
                    <ClockIcon />
                    {s.expected} min
                  </span>
                </div>
              </div>
              <div className="svm-card-actions">
                <button className="sm-btn sm-btn-edit" onClick={() => startEdit(s)}>Edit</button>
                <button className="sm-btn sm-btn-delete" onClick={() => setDeleteId(s.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {editing && (
        <div className="svm-overlay" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="svm-modal">
            <div className="svm-modal-header">
              <h3>{editing.id ? 'Edit Service' : 'New Service'}</h3>
              <button className="svm-close" onClick={() => setEditing(null)}>✕</button>
            </div>

            <div className="svm-modal-body">
              {apiError && <div className="form-error">{apiError}</div>}

              {/* Name */}
              <div className="form-row">
                <label>Service Name</label>
                <input
                  value={editing.name}
                  placeholder="e.g. Document Verification"
                  onChange={e => {
                    const next = { ...editing, name: e.target.value }
                    setEditing(next)
                    if (touched.name) runValidation(next)
                  }}
                  onBlur={() => { setTouched(t => ({ ...t, name: true })); runValidation() }}
                  className={fieldClass('name')}
                />
                {touched.name && errors.name && <div className="svm-err-text">{errors.name}</div>}
              </div>

              {/* Description */}
              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={editing.description}
                  placeholder="Brief description of this service..."
                  rows={3}
                  onChange={e => {
                    const next = { ...editing, description: e.target.value }
                    setEditing(next)
                    if (touched.description) runValidation(next)
                  }}
                  onBlur={() => { setTouched(t => ({ ...t, description: true })); runValidation() }}
                  className={fieldClass('description')}
                />
                {touched.description && errors.description && <div className="svm-err-text">{errors.description}</div>}
              </div>

              {/* Duration + Priority side by side */}
              <div className="svm-inline-grid">
                <div className="form-row">
                  <label>Duration (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.expected}
                    onChange={e => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      const next = { ...editing, expected: val }
                      setEditing(next)
                      if (touched.expected) runValidation(next)
                    }}
                    onBlur={() => { setTouched(t => ({ ...t, expected: true })); runValidation() }}
                    className={fieldClass('expected')}
                  />
                  {touched.expected && errors.expected && <div className="svm-err-text">{errors.expected}</div>}
                </div>

                <div className="form-row">
                  <label>Priority</label>
                  <select
                    value={editing.priority}
                    onChange={e => {
                      const next = { ...editing, priority: e.target.value }
                      setEditing(next)
                      if (touched.priority) runValidation(next)
                    }}
                    onBlur={() => { setTouched(t => ({ ...t, priority: true })); runValidation() }}
                    className={fieldClass('priority')}
                  >
                    <option value="">Select priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  {touched.priority && errors.priority && <div className="svm-err-text">{errors.priority}</div>}
                </div>
              </div>

              {/* Open/Closed toggle */}
              <div className="form-row">
                <label>Queue Status</label>
                <div className="svc-toggle-wrapper">
                  <label className="svc-toggle">
                    <input
                      type="checkbox"
                      checked={!!editing.open}
                      onChange={e => setEditing({ ...editing, open: e.target.checked })}
                    />
                    <span className="svc-toggle-slider"></span>
                  </label>
                  <span className={`svc-toggle-label ${editing.open ? 'open' : 'closed'}`}>
                    {editing.open ? 'Open — accepting customers' : 'Closed — not accepting customers'}
                  </span>
                </div>
              </div>
            </div>

            <div className="svm-modal-footer">
              <button className="svm-btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
              <button className="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editing.id ? 'Save Changes' : 'Create Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="svm-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="svm-confirm">
            <div className="svm-confirm-icon"><TrashIcon /></div>
            <h3>Delete this service?</h3>
            <p>This will permanently remove the service and cannot be undone. Active queue entries for this service may be affected.</p>
            <div className="svm-confirm-actions">
              <button className="svm-btn-cancel" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="svm-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
