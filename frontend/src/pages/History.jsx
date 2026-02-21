import { getCurrentUser, getHistoryForUser, getServices } from '../services/localApi'

export default function History() {
  const user = getCurrentUser()
  const history = user ? getHistoryForUser(user.id) : []
  const services = getServices()

  function svcName(id) {
    return services.find(s => s.id === id)?.name || id
  }

  // Show most recent first
  const sorted = [...history].reverse()

  return (
    <div className="card">
      <h2>Queue History</h2>
      {sorted.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No past queues yet.</div>
      ) : (
        <table className="admin-table" style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Service</th>
              <th>Priority</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(h => (
              <tr key={h.id}>
                <td>{new Date(h.date).toLocaleString()}</td>
                <td className="service-name">{h.serviceName || svcName(h.serviceId)}</td>
                <td>
                  {h.priority ? (
                    <span className={`priority-badge priority-${h.priority}`}>{h.priority}</span>
                  ) : '—'}
                </td>
                <td>
                  <span className="status-badge status-open">{h.outcome}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
