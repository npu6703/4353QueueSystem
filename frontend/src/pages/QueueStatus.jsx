import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, getUserQueueStatus, getServices, getQueueForService, leaveQueue } from '../services/localApi'
import '../styles/QueueStatus.css'

export default function QueueStatus() {
  const [services, setServices] = useState([])
  const [, setTick] = useState(0)
  const user = getCurrentUser()

  useEffect(() => { setServices(getServices()) }, [])

  const status = user ? getUserQueueStatus(user.id) : null
  const svc = status ? services.find(s => s.id === status.serviceId) : null
  const queue = status ? getQueueForService(status.serviceId) : []
  const totalInQueue = queue.length

  function estWait() {
    if (!status || !svc) return 0
    return status.position * (svc.expected || 10)
  }

  function getStatusText() {
    if (!status) return ''
    if (status.position === 1) return 'Almost ready'
    return 'Waiting'
  }

  function getStatusClass() {
    if (!status) return ''
    if (status.position === 1) return 'almost'
    return 'waiting'
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  function getProgress() {
    if (!totalInQueue || !status) return 0
    return Math.max(8, Math.round(((totalInQueue - status.position + 1) / totalInQueue) * 100))
  }

  function handleLeave() {
    if (status) {
      leaveQueue(status.serviceId, user.id)
      setTick(t => t + 1)
      setServices(getServices())
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
            <span className="qs-row-value">{estWait()} min</span>
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
            <span className="qs-row-value">{totalInQueue}</span>
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
