import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, getHistoryForUser, getServices } from '../services/localApi'
import '../styles/History.css'

export default function History() {
  const user = getCurrentUser()
  const history = user ? getHistoryForUser(user.id) : []
  const services = getServices()
  const [filter, setFilter] = useState('all')

  function svcName(id) {
    return services.find(s => s.id === id)?.name || id
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
  }

  function outcomeClass(outcome) {
    if (outcome === 'served') return 'served'
    if (outcome === 'left') return 'left'
    return 'cancelled'
  }

  const filtered = filter === 'all'
    ? history
    : history.filter(h => h.outcome === filter)

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date))

  const counts = { all: history.length, served: 0, left: 0 }
  history.forEach(h => { if (counts[h.outcome] !== undefined) counts[h.outcome]++ })

  if (history.length === 0) {
    return (
      <div className="hist-page">
        <div className="hist-header">
          <div className="hist-header-text">
            <h2>Queue History</h2>
            <p>Your past queue participation.</p>
          </div>
        </div>
        <div className="hist-card">
          <div className="hist-empty">
            <h3>No history yet</h3>
            <p>Records will appear here after you have been served.</p>
            <Link to="/join" className="hist-btn-go">Join a Queue</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hist-page">
      <div className="hist-header">
        <div className="hist-header-text">
          <h2>Queue History</h2>
          <p>Your past queue participation.</p>
        </div>
        <span className="hist-count">{history.length} {history.length === 1 ? 'record' : 'records'}</span>
      </div>

      <div className="hist-card">
        {/* Filters */}
        <div className="hist-filters">
          {['all', 'served', 'left'].map(f => (
            <button
              key={f}
              className={`hist-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
            </button>
          ))}
        </div>

        {/* Table */}
        {sorted.length > 0 ? (
          <table className="hist-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const { date, time } = formatDate(h.date)
                return (
                  <tr key={h.id}>
                    <td data-label="Date">
                      <div className="hist-date">
                        <span className="hist-date-main">{date}</span>
                        <span className="hist-date-time">{time}</span>
                      </div>
                    </td>
                    <td data-label="Service">
                      <span className="hist-svc-name">{svcName(h.serviceId)}</span>
                    </td>
                    <td data-label="Outcome">
                      <span className={`hist-outcome ${outcomeClass(h.outcome)}`}>
                        <span className="hist-outcome-dot"></span>
                        {h.outcome.charAt(0).toUpperCase() + h.outcome.slice(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="hist-no-results">No records match this filter.</div>
        )}
      </div>
    </div>
  )
}
