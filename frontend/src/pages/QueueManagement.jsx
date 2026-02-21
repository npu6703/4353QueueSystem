import { useState, useEffect } from 'react'
import {
  getServices, getSortedQueue, serveNext, removeFromQueue,
  boostUser, moveToTop, changeUserPriority, calcEffectiveScore, saveService,
  adminAddToQueue
} from '../services/localApi'
import '../styles/AdminDashboard.css'

export default function QueueManagement() {
  const [services, setServices] = useState([])
  const [selectedSvc, setSelectedSvc] = useState('')
  const [message, setMessage] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInPriority, setWalkInPriority] = useState('low')
  const [, setTick] = useState(0)

  useEffect(() => {
    const svcs = getServices()
    setServices(svcs)
    if (svcs.length > 0) setSelectedSvc(svcs[0].id)
  }, [])

  // Refresh every 5s so scores update live from aging
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  function refresh() { setServices(getServices()) }

  function showMsg(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  function handleServe(serviceId) {
    const result = serveNext(serviceId)
    if (!result) showMsg('error', 'No one in queue to serve')
    else showMsg('success', `Served: ${result.userName}`)
    refresh()
  }

  function handleRemove(serviceId, userId, userName) {
    removeFromQueue(serviceId, userId)
    showMsg('success', `Removed ${userName} from queue`)
    refresh()
  }

  function handleMoveUp(serviceId, userId) {
    boostUser(serviceId, userId, 1)
    refresh()
  }

  function handleMoveDown(serviceId, userId) {
    boostUser(serviceId, userId, -1)
    refresh()
  }

  function handleMoveToTop(serviceId, userId, userName) {
    moveToTop(serviceId, userId)
    showMsg('success', `Moved ${userName} to top of queue`)
    refresh()
  }

  function handlePriorityChange(serviceId, userId, newPriority) {
    changeUserPriority(serviceId, userId, newPriority)
    refresh()
  }

  function handleAddWalkIn() {
    if (!walkInName.trim()) { showMsg('error', 'Please enter a name'); return }
    if (!selectedSvc) { showMsg('error', 'Please select a service first'); return }
    adminAddToQueue(selectedSvc, walkInName.trim(), walkInPriority, walkInPhone.trim(), walkInNotes.trim())
    showMsg('success', `Added ${walkInName.trim()} to queue`)
    setWalkInName('')
    setWalkInPhone('')
    setWalkInNotes('')
    setWalkInPriority('low')
    setShowAddForm(false)
    refresh()
  }

  function handleToggleService(svc) {
    saveService({ ...svc, open: !svc.open })
    refresh()
  }

  function getWaitedMin(joinedAt) {
    return Math.round((Date.now() - new Date(joinedAt).getTime()) / 60000)
  }

  const currentSvc = services.find(s => s.id === selectedSvc)
  const sortedQueue = selectedSvc ? getSortedQueue(selectedSvc) : []
  const totalInAllQueues = services.reduce((sum, s) => sum + getSortedQueue(s.id).length, 0)

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h2>Queue Management</h2>
          <p className="admin-subtitle">
            Monitor and manage live queues — {totalInAllQueues} total {totalInAllQueues === 1 ? 'person' : 'people'} waiting
          </p>
        </div>
      </div>

      {/* Feedback message */}
      {message && (
        <div className={message.type === 'error' ? 'form-error' : 'form-success'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* Service selector cards */}
      <div className="qm-service-cards">
        {services.map(s => {
          const q = getSortedQueue(s.id)
          const isSelected = selectedSvc === s.id
          return (
            <div
              key={s.id}
              className={`qm-service-card ${isSelected ? 'qm-service-card-selected' : ''}`}
              onClick={() => setSelectedSvc(s.id)}
            >
              <div className="qm-service-card-top">
                <span className="qm-service-card-name">{s.name}</span>
                <span className={`status-badge ${s.open ? 'status-open' : 'status-closed'}`}>
                  {s.open ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="qm-service-card-count">{q.length}</div>
              <div className="qm-service-card-label">in queue</div>
              <div className="qm-service-card-wait">
                ~{q.length * (s.expected || 10)} min total wait
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected service queue detail */}
      {currentSvc && (
        <div className="admin-table-wrapper">
          {/* Header row */}
          <div className="qm-queue-header">
            <div>
              <h3 className="admin-table-title" style={{ margin: 0 }}>
                {currentSvc.name}
                <span className={`status-badge ${currentSvc.open ? 'status-open' : 'status-closed'}`} style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                  {currentSvc.open ? 'Open' : 'Closed'}
                </span>
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {sortedQueue.length} {sortedQueue.length === 1 ? 'person' : 'people'} — Priority: {currentSvc.priority} — ~{currentSvc.expected} min/person
              </span>
            </div>
            <div className="qm-queue-actions">
              <button
                className="admin-btn admin-btn-outline"
                onClick={() => setShowAddForm(!showAddForm)}
                disabled={!currentSvc.open}
                title={!currentSvc.open ? 'Open this service first' : ''}
              >
                + Add Walk-in
              </button>
              <button
                className={`admin-btn ${currentSvc.open ? 'admin-btn-danger' : 'admin-btn-success'}`}
                onClick={() => handleToggleService(currentSvc)}
              >
                {currentSvc.open ? 'Close Queue' : 'Open Queue'}
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => handleServe(selectedSvc)}
                disabled={sortedQueue.length === 0 || !currentSvc.open}
                title={!currentSvc.open ? 'Open this service first' : ''}
              >
                Serve Next
              </button>
            </div>
          </div>

          {/* Walk-in add form */}
          {showAddForm && (
            <div className="qm-walkin-form">
              <h4 style={{ margin: '0 0 0.75rem 0' }}>Add Walk-in to Queue</h4>
              <div className="qm-walkin-row">
                <div className="form-row" style={{ flex: 2, marginBottom: 0 }}>
                  <label>Name <span className="required">*</span></label>
                  <input
                    value={walkInName}
                    onChange={e => setWalkInName(e.target.value)}
                    placeholder="Person's name"
                    maxLength={100}
                  />
                </div>
                <div className="form-row" style={{ flex: 1.5, marginBottom: 0 }}>
                  <label>Phone</label>
                  <input
                    value={walkInPhone}
                    onChange={e => setWalkInPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    maxLength={20}
                  />
                </div>
                <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Priority</label>
                  <select value={walkInPriority} onChange={e => setWalkInPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="qm-walkin-row" style={{ marginTop: '0.5rem' }}>
                <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Notes <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <input
                    value={walkInNotes}
                    onChange={e => setWalkInNotes(e.target.value)}
                    placeholder="Reason for visit, special requests, etc."
                    maxLength={200}
                  />
                </div>
                <div className="qm-walkin-actions">
                  <button className="admin-btn admin-btn-primary" onClick={handleAddWalkIn}>Add to Queue</button>
                  <button className="admin-btn admin-btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                </div>
              </div>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                📱 Phone number stored for SMS notification when it&apos;s their turn (requires backend integration).
              </p>
            </div>
          )}

          {sortedQueue.length === 0 ? (
            <div className="qm-empty">
              No one in this queue right now.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Name</th>
                  <th>Priority</th>
                  <th>Waited</th>
                  <th>Score</th>
                  <th>Joined</th>
                  <th>Reorder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedQueue.map((entry, i) => (
                  <tr key={entry.userId} className={i === 0 ? 'qm-next-row' : ''}>
                    <td><strong>{i + 1}</strong></td>
                    <td className="service-name">
                      {entry.userName}
                      {i === 0 && <span className="queue-next-tag">NEXT</span>}
                      {entry.walkIn && <span className="qm-walkin-tag">Walk-in</span>}
                      {entry.phone && <span className="qm-phone-tag" title={entry.phone}>{entry.phone}</span>}
                      {entry.notes && <div className="qm-entry-notes" title={entry.notes}>💬 {entry.notes}</div>}
                    </td>
                    <td>
                      <select
                        className="qm-priority-select"
                        value={entry.priority}
                        onChange={e => handlePriorityChange(selectedSvc, entry.userId, e.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </td>
                    <td>{getWaitedMin(entry.joinedAt)} min</td>
                    <td><strong>{calcEffectiveScore(entry).toFixed(1)}</strong></td>
                    <td>{new Date(entry.joinedAt).toLocaleTimeString()}</td>
                    <td>
                      <div className="qm-reorder-btns">
                        {i > 0 && (
                          <button
                            className="qm-arrow-btn"
                            onClick={() => handleMoveUp(selectedSvc, entry.userId)}
                            title="Move up"
                          >
                            &#9650;
                          </button>
                        )}
                        {i < sortedQueue.length - 1 && (
                          <button
                            className="qm-arrow-btn"
                            onClick={() => handleMoveDown(selectedSvc, entry.userId)}
                            title="Move down"
                          >
                            &#9660;
                          </button>
                        )}
                        {i > 0 && (
                          <button
                            className="qm-top-btn"
                            onClick={() => handleMoveToTop(selectedSvc, entry.userId, entry.userName)}
                            title="Move to top"
                          >
                            Top
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-danger"
                        onClick={() => handleRemove(selectedSvc, entry.userId, entry.userName)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Algorithm explanation */}
          <div className="queue-algo-info">
            <strong>How scoring works:</strong> Score = Priority Weight (high: 30, medium: 15, low: 0) + (Minutes Waiting × 1).
            Highest score gets served first. Admins can override order using the arrow buttons or by changing priority.
          </div>
        </div>
      )}
    </div>
  )
}
