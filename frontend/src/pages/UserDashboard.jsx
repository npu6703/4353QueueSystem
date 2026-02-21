import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, getServices, getUserQueueStatus, getSortedQueue } from '../services/localApi'

export default function UserDashboard() {
  const [services, setServices] = useState([])
  const user = getCurrentUser()
  const [, setTick] = useState(0)

  useEffect(() => { setServices(getServices()) }, [])

  // Refresh every 15s for live updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  const status = user ? getUserQueueStatus(user.id) : null

  return (
    <div className="card">
      <h2>Welcome{user ? ', ' + user.name : ''}</h2>

      {/* Queue status banner */}
      {status ? (
        <div className="queue-status-banner" style={{ marginBottom: '1.5rem' }}>
          <div className="queue-status-banner-text">
            You are in <strong>{status.serviceName}</strong> — Position #{status.position} of {status.total}
            <span className={`priority-badge priority-${status.priority}`} style={{ marginLeft: '0.5rem' }}>
              {status.priority}
            </span>
            {status.position === 1 && <span className="queue-next-tag">NEXT</span>}
          </div>
          <Link to="/status"><button className="admin-btn admin-btn-primary">View Status</button></Link>
        </div>
      ) : (
        <div className="dash-join-prompt">
          Not in a queue. <Link to="/join">Join one now</Link>
        </div>
      )}

      {/* Services list */}
      <h3 style={{ marginBottom: '0.75rem' }}>Available Services</h3>
      <div className="dash-services-grid">
        {services.map(s => {
          const q = getSortedQueue(s.id)
          return (
            <div key={s.id} className="dash-service-card">
              <div className="dash-service-header">
                <span className="dash-service-name">{s.name}</span>
                <span className={`status-badge ${s.open ? 'status-open' : 'status-closed'}`}>
                  {s.open ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="dash-service-desc">{s.description}</div>
              <div className="dash-service-meta">
                <span>{q.length} in queue</span>
                <span>~{q.length * (s.expected || 10)} min wait</span>
                <span className={`priority-badge priority-${s.priority}`}>{s.priority}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
