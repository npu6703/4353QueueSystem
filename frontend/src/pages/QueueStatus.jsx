import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, getServices } from '../services/localApi'
import { getQueueStatus, leaveQueue } from '../services/userApi'
import '../styles/QueueStatus.css'

export default function QueueStatus() {
  const [services, setServices] = useState([])
  const [status, setStatus] = useState(null)
  const user = getCurrentUser()

  useEffect(() => {
    setServices(getServices())
    if (!user) return
    getQueueStatus(user.id).then(setStatus).catch(() => setStatus(null))
    const interval = setInterval(() => {
      getQueueStatus(user.id).then(setStatus).catch(() => setStatus(null))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const svc = status ? services.find(s => s.id === status.serviceId) : null

  function getStatusText() {
    if (!status) return ''
    return status.position === 1 ? 'Almost ready' : 'Waiting'
  }

  function getStatusClass() {
    if (!status) return ''
    return status.position === 1 ? 'almost' : 'waiting'
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  function getProgress() {
    if (!status) return 0
    return Math.max(8, Math.round(((status.total - status.position + 1) / status.total) * 100))
  }

  async function handleLeave() {
    if (!status) return
    try {
      await leaveQueue(status.serviceId, user.id)
      setStatus(null)
    } catch {
      // leave silently — status will re-check on next load
    }
  }

  if (!status) {
    return (
      <div className="qs-page">
        <div className="qs-header">
          <h2>Queue Status</h2>
          <p>Track your current position in real time.</p>
        </div>
        <div className="qs-empty">
          <h3>Not in a queue</h3>
          <p>Join a service to start tracking your position.</p>
          <Link to="/join" className="qs-btn-go">Join a Queue</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="qs-page">
      <div className="qs-header">
        <h2>Queue Status</h2>
        <p>Real-time position tracking.</p>
      </div>

      <div className="qs-card">
        {/* Hero */}
        <div className="qs-hero">
          <div className="qs-hero-label">Your Position</div>
          <div className="qs-hero-number">{status.position}</div>
          <div className="qs-hero-ordinal">{status.position}{getOrdinal(status.position)} in line</div>
          <div className="qs-hero-service">{svc?.name || status.serviceId}</div>
        </div>

        {/* Progress */}
        <div className="qs-progress">
          <div className="qs-progress-track">
            <div className="qs-progress-fill" style={{ width: `${getProgress()}%` }}></div>
          </div>
          <div className="qs-progress-labels">
            <span>Joined</span>
            <span>{getProgress()}%</span>
            <span>Your turn</span>
          </div>
        </div>

        {/* Details */}
        <div className="qs-details">
          <div className="qs-row">
            <span className="qs-row-label">Service</span>
            <span className="qs-row-value">{svc?.name || status.serviceId}</span>
          </div>
          <div className="qs-row">
            <span className="qs-row-label">People ahead</span>
            <span className="qs-row-value">{status.position - 1}</span>
          </div>
          <div className="qs-row">
            <span className="qs-row-label">Estimated wait</span>
            <span className="qs-row-value">{status.expectedWait} min</span>
          </div>
          <div className="qs-row">
            <span className="qs-row-label">Status</span>
            <span className={`qs-chip ${getStatusClass()}`}>
              <span className="qs-chip-dot"></span>
              {getStatusText()}
            </span>
          </div>
          <div className="qs-row">
            <span className="qs-row-label">Total in queue</span>
            <span className="qs-row-value">{status.total}</span>
          </div>
        </div>

        {/* Leave */}
        <div className="qs-actions">
          <button className="qs-btn-leave" onClick={handleLeave}>Leave Queue</button>
        </div>
      </div>
    </div>
  )
}
