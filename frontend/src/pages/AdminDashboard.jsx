import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../services/localApi'
import { getAdminStats, getAllQueues, getAdminHistory, getServices, toggleService } from '../services/adminApi'
import '../styles/AdminDashboard.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalServices: 0, openCount: 0, closedCount: 0, totalInQueue: 0, todayServed: 0 })
  const [queues, setQueues] = useState([])
  const [services, setServices] = useState([])
  const [history, setHistory] = useState([])
  const user = getCurrentUser()

  const loadAll = useCallback(async () => {
    try {
      const [s, q, h, svcs] = await Promise.all([getAdminStats(), getAllQueues(), getAdminHistory(), getServices()])
      setStats(s)
      setQueues(q)
      setHistory(h)
      setServices(svcs)
    } catch {
      // server may not be running
    }
  }, [])

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 1000)
    return () => clearInterval(interval)
  }, [loadAll])

  async function handleToggle(serviceId) {
    try {
      await toggleService(serviceId)
      await loadAll()
    } catch {
      // ignore
    }
  }

  const activeQueues = queues.filter(q => q.count > 0)
  const recentHistory = history.slice(0, 10)

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="admin-subtitle">Welcome back, {user?.name || 'Admin'}. Here&apos;s your queue overview.</p>
        </div>
        <div className="admin-nav-buttons">
          <Link to="/admin/services"><button className="admin-btn admin-btn-outline">Manage Services</button></Link>
          <Link to="/admin/queues"><button className="admin-btn admin-btn-primary">Manage Queues</button></Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-number">{stats.totalServices}</span>
          <span className="stat-label">Total Services</span>
        </div>
        <div className="stat-card stat-card-green">
          <span className="stat-number">{stats.openCount}</span>
          <span className="stat-label">Open</span>
        </div>
        <div className="stat-card stat-card-red">
          <span className="stat-number">{stats.closedCount}</span>
          <span className="stat-label">Closed</span>
        </div>
        <div className="stat-card stat-card-amber">
          <span className="stat-number">{stats.totalInQueue}</span>
          <span className="stat-label">In Queue</span>
        </div>
      </div>

      {/* Active queues */}
      {activeQueues.length > 0 && (
        <div className="admin-active-queues">
          <h3 className="admin-section-title">Active Queues</h3>
          <div className="admin-queue-cards">
            {activeQueues.map(q => (
              <div key={q.serviceId} className="admin-queue-card">
                <div className="admin-queue-card-header">
                  <span className="admin-queue-card-name">{q.serviceName}</span>
                  <span className="queue-badge">{q.count}</span>
                </div>
                {q.next && (
                  <div className="admin-queue-card-next">
                    Next: <strong>{q.next.userName}</strong>
                    <span className={`priority-badge priority-${q.next.priority}`} style={{ marginLeft: '0.4rem' }}>
                      {q.next.priority}
                    </span>
                  </div>
                )}
                <div className="admin-queue-card-wait">~{q.expectedWait} min total wait</div>
                <Link to="/admin/queues">
                  <button className="admin-btn admin-btn-outline" style={{ marginTop: '0.5rem', width: '100%' }}>
                    Manage
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services overview table */}
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
            {queues.map(q => {
              const svc = services.find(s => s.id === q.serviceId)
              return (
              <tr key={q.serviceId}>
                <td className="service-name">{q.serviceName}</td>
                <td className="service-desc">{svc?.description || '—'}</td>
                <td><span className="queue-badge">{q.count}</span></td>
                <td>{q.expectedWait > 0 ? `${q.expectedWait} min` : '—'}</td>
                <td>{svc ? <span className={`priority-badge priority-${svc.priority}`}>{svc.priority}</span> : '—'}</td>
                <td>
                  <span className={`status-badge ${q.open ? 'status-open' : 'status-closed'}`}>
                    {q.open ? 'Open' : 'Closed'}
                  </span>
                </td>
                <td>
                  <button
                    className={`admin-btn ${q.open ? 'admin-btn-danger' : 'admin-btn-success'}`}
                    onClick={() => handleToggle(q.serviceId)}
                  >
                    {q.open ? 'Close' : 'Open'}
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent activity */}
      {recentHistory.length > 0 && (
        <div className="admin-table-wrapper" style={{ marginTop: '1.5rem' }}>
          <h3 className="admin-table-title">Recent Activity ({stats.todayServed} served today)</h3>
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
              {recentHistory.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.date).toLocaleString()}</td>
                  <td className="service-name">{h.userName || h.userId}</td>
                  <td>{h.serviceName || h.serviceId}</td>
                  <td>
                    {h.priority
                      ? <span className={`priority-badge priority-${h.priority}`}>{h.priority}</span>
                      : '—'}
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
