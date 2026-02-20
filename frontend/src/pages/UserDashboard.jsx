import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, getServices, getUserQueueStatus, getQueueForService, getHistoryForUser } from '../services/localApi'
import '../styles/UserDashboard.css'

export default function UserDashboard() {
  const [services, setServices] = useState([])
  const user = getCurrentUser()

  useEffect(() => { setServices(getServices()) }, [])

  const status = user ? getUserQueueStatus(user.id) : null
  const history = user ? getHistoryForUser(user.id) : []
  const openServices = services.filter(s => s.open)
  const activeService = status ? services.find(s => s.id === status.serviceId) : null

  function estWait() {
    if (!status || !activeService) return '—'
    return `${status.position * (activeService.expected || 10)} min`
  }

  function getQueueLength(serviceId) {
    return getQueueForService(serviceId).length
  }

  return (
    <div className="ud-page">
      <div className="ud-header">
        <h2>{user ? `Welcome, ${user.name}` : 'Dashboard'}</h2>
        <p className="ud-subtitle">Your queue overview at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="ud-stats">
        <div className="ud-stat-card green">
          <div className="ud-stat-label">Open Services</div>
          <div className="ud-stat-value">{openServices.length}</div>
          <div className="ud-stat-note">of {services.length} total</div>
        </div>
        <div className={`ud-stat-card ${status ? 'amber' : 'muted'}`}>
          <div className="ud-stat-label">Position</div>
          <div className="ud-stat-value">{status ? `#${status.position}` : '—'}</div>
          <div className="ud-stat-note">{status ? (activeService?.name || status.serviceId) : 'Not in queue'}</div>
        </div>
        <div className="ud-stat-card blue">
          <div className="ud-stat-label">Est. Wait</div>
          <div className="ud-stat-value">{status ? estWait() : '—'}</div>
          <div className="ud-stat-note">{status ? 'approximate' : 'N/A'}</div>
        </div>
        <div className="ud-stat-card muted">
          <div className="ud-stat-label">Past Visits</div>
          <div className="ud-stat-value">{history.length}</div>
          <div className="ud-stat-note">total queues joined</div>
        </div>
      </div>

      {/* Two-column */}
      <div className="ud-grid">
        {/* Services */}
        <div className="ud-panel">
          <div className="ud-panel-head">
            <h3>Available Services</h3>
            <span className="ud-panel-count">{services.length} services</span>
          </div>
          <div className="ud-panel-body">
            {services.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No services available.</p>
            )}
            {services.map(s => (
              <div className="ud-svc-row" key={s.id}>
                <div className="ud-svc-info">
                  <span className="ud-svc-name">{s.name}</span>
                  <span className="ud-svc-meta">{s.description} &middot; {s.expected} min &middot; {getQueueLength(s.id)} in queue</span>
                </div>
                <span className={`ud-status-tag ${s.open ? 'open' : 'closed'}`}>
                  <span className="ud-status-dot"></span>
                  {s.open ? 'Open' : 'Closed'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Queue Status */}
        <div className="ud-panel">
          <div className="ud-panel-head">
            <h3>Current Queue</h3>
          </div>
          <div className="ud-panel-body">
            {status ? (
              <div className="ud-queue-active">
                <div className="ud-queue-pos-row">
                  <div className="ud-queue-pos-circle">#{status.position}</div>
                  <div className="ud-queue-pos-text">
                    <strong>{activeService?.name || status.serviceId}</strong>
                    <span>Estimated wait: {estWait()}</span>
                  </div>
                </div>
                <span className={`ud-queue-chip ${status.position === 1 ? 'almost' : 'waiting'}`}>
                  <span className="ud-status-dot"></span>
                  {status.position === 1 ? 'Almost ready' : 'Waiting'}
                </span>
                <Link to="/status" className="ud-queue-link">View full status &rarr;</Link>
              </div>
            ) : (
              <div className="ud-queue-empty">
                <p>You are not currently in any queue.</p>
                <Link to="/join" className="ud-btn-sm">Join a Queue</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="ud-quick-nav">
        <Link to="/join" className="ud-nav-card">
          <div className="ud-nav-icon join">+</div>
          <div className="ud-nav-text">
            <strong>Join Queue</strong>
            <span>Browse and join services</span>
          </div>
        </Link>
        <Link to="/status" className="ud-nav-card">
          <div className="ud-nav-icon status">#</div>
          <div className="ud-nav-text">
            <strong>Queue Status</strong>
            <span>Track your position</span>
          </div>
        </Link>
        <Link to="/history" className="ud-nav-card">
          <div className="ud-nav-icon hist">H</div>
          <div className="ud-nav-text">
            <strong>History</strong>
            <span>View past visits</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
