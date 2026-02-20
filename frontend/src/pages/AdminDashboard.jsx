import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getServices, getQueueForService, saveService } from '../services/localApi'
import '../styles/AdminDashboard.css'

export default function AdminDashboard(){
  const [services, setServices] = useState(getServices())

  function toggleOpen(svc){
    const updated = { ...svc, open: !svc.open }
    saveService(updated)
    setServices(getServices())
  }

  const totalInQueue = services.reduce((sum, s) => sum + getQueueForService(s.id).length, 0)
  const openCount = services.filter(s => s.open).length
  const closedCount = services.length - openCount

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="admin-subtitle">Manage your restaurant queue system</p>
        </div>
        <div className="admin-nav-buttons">
          <Link to="/admin/services"><button className="admin-btn admin-btn-outline">Manage Services</button></Link>
          <Link to="/admin/queues"><button className="admin-btn admin-btn-primary">Manage Queues</button></Link>
        </div>
      </div>

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
              const queueLen = getQueueForService(s.id).length
              const estWait = queueLen * (s.expected || 10)
              return (
                <tr key={s.id}>
                  <td className="service-name">{s.name}</td>
                  <td className="service-desc">{s.description}</td>
                  <td>
                    <span className="queue-badge">{queueLen}</span>
                  </td>
                  <td>{estWait > 0 ? `${estWait} min` : '—'}</td>
                  <td>
                    <span className={`priority-badge priority-${s.priority}`}>
                      {s.priority}
                    </span>
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
    </div>
  )
}