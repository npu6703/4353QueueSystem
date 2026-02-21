import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getServices, getSortedQueue, saveService, getAllHistory, getCurrentUser } from '../services/localApi'
import '../styles/AdminDashboard.css'

export default function AdminDashboard() {
  const [services, setServices] = useState(getServices())
  const [, setTick] = useState(0)
  const user = getCurrentUser()
  const history = getAllHistory()

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      setServices(getServices())
      setTick(t => t + 1)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  function toggleOpen(svc) {
    saveService({ ...svc, open: !svc.open })
    setServices(getServices())
  }

  const totalInQueue = services.reduce((sum, s) => sum + getSortedQueue(s.id).length, 0)
  const openCount = services.filter(s => s.open).length
  const closedCount = services.length - openCount
  const todayServed = history.filter(h => {
    const d = new Date(h.date)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="admin-subtitle">Welcome back, {user?.name || 'Admin'}. Here's your queue overview.</p>
        </div>
        <div className="admin-nav-buttons">
          <Link to="/admin/services"><button className="admin-btn admin-btn-outline">Manage Services</button></Link>
          <Link to="/admin/queues"><button className="admin-btn admin-btn-primary">Manage Queues</button></Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-number">{services.length}</span>
          <span className="stat-label">Total Services</span>
        </div>
        <div className="stat-card stat-card-green">
          <span className="stat-number">{openCount}</span>
          <span className="stat-label">Open</span>
        </div>
        <div className="stat-card stat-card-red">
          <span className="stat-number">{closedCount}</span>
          <span className="stat-label">Closed</span>
        </div>
        <div className="stat-card stat-card-amber">
          <span className="stat-number">{totalInQueue}</span>
          <span className="stat-label">In Queue</span>
        </div>
      </div>

      {/* Quick glance: active queues */}
      {totalInQueue > 0 && (
        <div className="admin-active-queues">
          <h3 className="admin-section-title">Active Queues</h3>
          <div className="admin-queue-cards">
            {services.filter(s => getSortedQueue(s.id).length > 0).map(s => {
              const q = getSortedQueue(s.id)
              const nextUser = q[0]
              return (
                <div key={s.id} className="admin-queue-card">
                  <div className="admin-queue-card-header">
                    <span className="admin-queue-card-name">{s.name}</span>
                    <span className="queue-badge">{q.length}</span>
                  </div>
                  <div className="admin-queue-card-next">
                    Next: <strong>{nextUser.userName}</strong>
                    <span className={`priority-badge priority-${nextUser.priority}`} style={{ marginLeft: '0.4rem' }}>
                      {nextUser.priority}
                    </span>
                  </div>
                  <div className="admin-queue-card-wait">
                    ~{q.length * (s.expected || 10)} min total wait
                  </div>
                  <Link to="/admin/queues">
                    <button className="admin-btn admin-btn-outline" style={{ marginTop: '0.5rem', width: '100%' }}>
                      Manage
                    </button>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Services table */}
      <div className="admin-table-wrapper">
        <h3 className="admin-table-title">Services Overview</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Description</th>
              <th>Queue</th>
              <th>Est. Wait</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => {
              const queueLen = getSortedQueue(s.id).length
              const estWait = queueLen * (s.expected || 10)
              return (
                <tr key={s.id}>
                  <td className="service-name">{s.name}</td>
                  <td className="service-desc">{s.description}</td>
                  <td><span className="queue-badge">{queueLen}</span></td>
                  <td>{estWait > 0 ? `${estWait} min` : '—'}</td>
                  <td>
                    <span className={`priority-badge priority-${s.priority}`}>{s.priority}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${s.open ? 'status-open' : 'status-closed'}`}>
                      {s.open ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`admin-btn ${s.open ? 'admin-btn-danger' : 'admin-btn-success'}`}
                      onClick={() => toggleOpen(s)}
                    >
                      {s.open ? 'Close' : 'Open'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent activity */}
      {history.length > 0 && (
        <div className="admin-table-wrapper" style={{ marginTop: '1.5rem' }}>
          <h3 className="admin-table-title">Recent Activity ({todayServed} served today)</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Person</th>
                <th>Service</th>
                <th>Priority</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().slice(0, 10).map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.date).toLocaleString()}</td>
                  <td className="service-name">{h.userName || h.userId}</td>
                  <td>{h.serviceName || h.serviceId}</td>
                  <td>
                    {h.priority ? (
                      <span className={`priority-badge priority-${h.priority}`}>{h.priority}</span>
                    ) : '—'}
                  </td>
                  <td><span className="status-badge status-open">{h.outcome}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
