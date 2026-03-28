import { useState, useEffect, useCallback } from 'react'
import {
  getAllQueues, getQueue, serveNext, addWalkIn, removeUser,
  boostUser, moveToTop, changePriority, toggleService,
} from '../services/adminApi'
import '../styles/AdminDashboard.css'

export default function QueueManagement() {
  const [summary, setSummary] = useState([])
  const [selectedSvc, setSelectedSvc] = useState('')
  const [queueData, setQueueData] = useState(null) // { service, queue }
  const [message, setMessage] = useState(null)
  const [nowServing, setNowServing] = useState(null) // { userName, priority, serviceName }
  const [showAddForm, setShowAddForm] = useState(false)
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInNotes, setWalkInNotes] = useState('')
  const [walkInPriority, setWalkInPriority] = useState('low')

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const loadSummary = useCallback(async () => {
    try {
      const data = await getAllQueues()
      setSummary(data)
      // Set initial selection once (state setter is stable, no dep needed)
      setSelectedSvc(prev => prev || (data.length > 0 ? data[0].serviceId : ''))
    } catch {
      showMsg('error', 'Could not load queues. Is the server running?')
    }
  }, [])

  const loadQueue = useCallback(async (svcId) => {
    if (!svcId) return
    try {
      const data = await getQueue(svcId)
      setQueueData(data)
    } catch {
      setQueueData(null)
    }
  }, [])

  useEffect(() => { loadSummary() }, [loadSummary])

  useEffect(() => { loadQueue(selectedSvc) }, [selectedSvc, loadQueue])

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadSummary()
      loadQueue(selectedSvc)
    }, 1000)
    return () => clearInterval(interval)
  }, [loadSummary, loadQueue, selectedSvc])

  async function handleServe() {
    try {
      const result = await serveNext(selectedSvc)
      setNowServing({
        userName: result.served.userName,
        priority: result.served.priority,
        serviceName: currentSvc?.name || '',
        servedAt: new Date().toLocaleTimeString(),
      })
      await loadSummary()
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleRemove(userId, userName) {
    try {
      await removeUser(selectedSvc, userId)
      showMsg('success', `Removed ${userName} from queue`)
      await loadSummary()
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleMoveUp(userId) {
    try {
      await boostUser(selectedSvc, userId, 5)
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleMoveDown(userId) {
    try {
      await boostUser(selectedSvc, userId, -5)
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleMoveToTop(userId, userName) {
    try {
      await moveToTop(selectedSvc, userId)
      showMsg('success', `Moved ${userName} to top of queue`)
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handlePriorityChange(userId, newPriority) {
    try {
      await changePriority(selectedSvc, userId, newPriority)
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleAddWalkIn() {
    if (!walkInName.trim()) { showMsg('error', 'Please enter a name'); return }
    if (!selectedSvc) { showMsg('error', 'Please select a service first'); return }
    try {
      await addWalkIn(selectedSvc, walkInName.trim(), walkInPriority)
      showMsg('success', `Added ${walkInName.trim()} to queue`)
      setWalkInName('')
      setWalkInPhone('')
      setWalkInNotes('')
      setWalkInPriority('low')
      setShowAddForm(false)
      await loadSummary()
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleToggleService() {
    try {
      await toggleService(selectedSvc)
      await loadSummary()
      await loadQueue(selectedSvc)
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  const currentSvc = queueData?.service
  const sortedQueue = queueData?.queue || []
  const totalInAllQueues = summary.reduce((sum, s) => sum + s.count, 0)

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

      {message && (
        <div className={`qm-toast qm-toast-${message.type}`}>
          <span className="qm-toast-icon">{message.type === 'error' ? '✕' : '✓'}</span>
          <span className="qm-toast-text">{message.text}</span>
          <div className="qm-toast-bar" />
        </div>
      )}

      {/* Now Serving banner */}
      {nowServing && (
        <div className="now-serving-banner">
          <div className="now-serving-left">
            <span className="now-serving-label">NOW SERVING</span>
            <span className="now-serving-name">{nowServing.userName}</span>
            <span className={`priority-badge priority-${nowServing.priority}`}>{nowServing.priority}</span>
          </div>
          <div className="now-serving-right">
            <span className="now-serving-meta">{nowServing.serviceName} · {nowServing.servedAt}</span>
            <button className="now-serving-done" onClick={() => setNowServing(null)}>✓ Done</button>
          </div>
        </div>
      )}

      {/* Service selector cards */}
      <div className="qm-service-cards">
        {summary.map(s => (
          <div
            key={s.serviceId}
            className={`qm-service-card ${selectedSvc === s.serviceId ? 'qm-service-card-selected' : ''}`}
            onClick={() => setSelectedSvc(s.serviceId)}
          >
            <div className="qm-service-card-top">
              <span className="qm-service-card-name">{s.serviceName}</span>
              <span className={`status-badge ${s.open ? 'status-open' : 'status-closed'}`}>
                {s.open ? 'Open' : 'Closed'}
              </span>
            </div>
            <div className="qm-service-card-count">{s.count}</div>
            <div className="qm-service-card-label">in queue</div>
            <div className="qm-service-card-wait">~{s.expectedWait} min total wait</div>
          </div>
        ))}
      </div>

      {/* Selected service queue detail */}
      {currentSvc && (
        <div className="admin-table-wrapper">
          <div className="qm-queue-header">
            <div>
              <h3 className="admin-table-title" style={{ margin: 0 }}>
                {currentSvc.name}
                <span
                  className={`status-badge ${currentSvc.open ? 'status-open' : 'status-closed'}`}
                  style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
                >
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
                onClick={handleToggleService}
              >
                {currentSvc.open ? 'Close Queue' : 'Open Queue'}
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleServe}
                disabled={sortedQueue.length === 0 || !currentSvc.open}
                title={!currentSvc.open ? 'Open this service first' : ''}
              >
                Serve Next
              </button>
            </div>
          </div>

          {/* Walk-in form */}
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
            </div>
          )}

          {sortedQueue.length === 0 ? (
            <div className="qm-empty">No one in this queue right now.</div>
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
                    </td>
                    <td>
                      <select
                        className="qm-priority-select"
                        value={entry.priority}
                        onChange={e => handlePriorityChange(entry.userId, e.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </td>
                    <td>{entry.waitedMinutes} min</td>
                    <td><strong>{entry.score}</strong></td>
                    <td>{new Date(entry.joinedAt).toLocaleTimeString()}</td>
                    <td>
                      <div className="qm-reorder-btns">
                        {i > 0 && (
                          <button className="qm-arrow-btn" onClick={() => handleMoveUp(entry.userId)} title="Move up">
                            &#9650;
                          </button>
                        )}
                        {i < sortedQueue.length - 1 && (
                          <button className="qm-arrow-btn" onClick={() => handleMoveDown(entry.userId)} title="Move down">
                            &#9660;
                          </button>
                        )}
                        {i > 0 && (
                          <button className="qm-top-btn" onClick={() => handleMoveToTop(entry.userId, entry.userName)} title="Move to top">
                            Top
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-danger"
                        onClick={() => handleRemove(entry.userId, entry.userName)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="queue-algo-info">
            <strong>How scoring works:</strong> Score = Priority Weight (high: 30, medium: 15, low: 0) + (Minutes Waiting × 1).
            Highest score gets served first. Admins can override order using the arrow buttons or by changing priority.
          </div>
        </div>
      )}
    </div>
  )
}
