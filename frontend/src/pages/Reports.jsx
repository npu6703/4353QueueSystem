import { useState, useEffect, useCallback } from 'react'
import {
  getUsersReport, getServicesReport, getQueueStatsReport, getUserHistoryReport,
  downloadReportCsv, getServices,
} from '../services/adminApi'
import '../styles/Reports.css'

// Top-level report tabs. Every tab supports a from/to date range that scopes
// the activity counts to that window. For Users specifically, an active filter
// means "users active in this window" — users with zero matching entries get
// dropped via HAVING in the SQL. With no filter, all four reports return
// lifetime data.
const TABS = [
  { key: 'users',     label: 'Users',         kind: 'users' },
  { key: 'services',  label: 'Services',      kind: 'services' },
  { key: 'stats',     label: 'Queue Stats',   kind: 'queue-stats' },
  { key: 'history',   label: 'Queue History', kind: 'user-history' },
]

function formatDate(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}

export default function Reports() {
  const [tab, setTab] = useState('users')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [serviceId, setServiceId] = useState('')
  // Optional userId filter for the History tab — set by clicking "View history"
  // on a Users row. There's no manual input; clearing happens via Clear filters.
  const [historyUserId, setHistoryUserId] = useState('')
  const [historyUserName, setHistoryUserName] = useState('')
  const [services, setServices] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Per-tab result state — keyed so switching tabs preserves prior data.
  const [usersData, setUsersData] = useState(null)
  const [servicesData, setServicesData] = useState(null)
  const [statsData, setStatsData] = useState(null)
  const [historyData, setHistoryData] = useState(null)

  useEffect(() => {
    getServices().then(setServices).catch(() => setServices([]))
  }, [])

  // Every tab supports date filters; only Stats supports the per-service drop-down.
  // History additionally supports a userId filter (set via the drilldown from
  // the Users tab — there's no manual input).
  const showServiceFilter = tab === 'stats'
  const showUserHint = tab === 'history' && !!historyUserId

  const filterParams = useCallback(() => {
    const p = {}
    if (from) p.from = from
    if (to) p.to = to
    return p
  }, [from, to])

  const generate = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'users') {
        setUsersData(await getUsersReport(filterParams()))
      } else if (tab === 'services') {
        setServicesData(await getServicesReport(filterParams()))
      } else if (tab === 'stats') {
        const params = filterParams()
        if (serviceId) params.serviceId = serviceId
        setStatsData(await getQueueStatsReport(params))
      } else if (tab === 'history') {
        const params = filterParams()
        if (historyUserId) params.userId = historyUserId
        setHistoryData(await getUserHistoryReport(params))
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }, [tab, filterParams, serviceId, historyUserId])

  // Auto-regenerate whenever the tab or any filter input changes.
  useEffect(() => { generate() }, [tab, from, to, serviceId, historyUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDownload() {
    setError('')
    try {
      const params = filterParams()
      const tabDef = TABS.find(t => t.key === tab)
      if (tab === 'stats' && serviceId) params.serviceId = serviceId
      if (tab === 'history' && historyUserId) params.userId = historyUserId
      await downloadReportCsv(tabDef.kind, params)
    } catch (err) {
      setError(err.message || 'Failed to download report')
    }
  }

  function clearFilters() {
    setFrom('')
    setTo('')
    setServiceId('')
    setHistoryUserId('')
    setHistoryUserName('')
    // The useEffect above will pick up the state changes and refetch.
  }

  // Drilldown: switch to History tab with userId pre-filled. Date filters
  // carry over so "users active in this range" → "this user's activity in the
  // same range" feels continuous.
  function viewUserHistory(userId, fullName) {
    setHistoryUserId(String(userId))
    setHistoryUserName(fullName || `User ${userId}`)
    setTab('history')
  }

  // Surfaces a hint when filters are active and the visible data set is empty
  // (or all aggregate counts are zero) — that's the most common "is this app
  // broken?" moment for a date-filtered Users / Services / History view.
  const hasActiveFilters = !!(
    from || to ||
    (showServiceFilter && serviceId) ||
    (tab === 'history' && historyUserId)
  )
  function isEmptyResult() {
    if (tab === 'users') return usersData?.data?.every(u => u.totalEntries === 0)
    if (tab === 'services') return servicesData?.data?.every(s => s.totalEntries === 0)
    if (tab === 'history') return (historyData?.count || 0) === 0
    if (tab === 'stats') return (statsData?.stats?.totalEntries || 0) === 0
    return false
  }
  const showFilterHint = hasActiveFilters && isEmptyResult()

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h2>Reports</h2>
          <p className="reports-subtitle">Generate and export administrative reports.</p>
        </div>
        <div className="reports-actions">
          <button className="reports-btn reports-btn-outline" onClick={generate} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="reports-btn reports-btn-primary" onClick={handleDownload} disabled={loading}>
            Download CSV
          </button>
        </div>
      </div>

      <div className="reports-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`reports-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="reports-filters">
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        {showServiceFilter && (
          <label>
            <span>Service</span>
            <select value={serviceId} onChange={e => setServiceId(e.target.value)}>
              <option value="">All services</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        {showUserHint && (
          <span className="reports-user-pill">
            User: <strong>{historyUserName}</strong>
            <button
              type="button"
              className="reports-pill-x"
              onClick={() => { setHistoryUserId(''); setHistoryUserName('') }}
              aria-label="Clear user filter"
            >×</button>
          </span>
        )}
        <button
          className="reports-btn reports-btn-outline"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          Clear filters
        </button>
        {hasActiveFilters && (
          <span className="reports-filter-active">Filters active</span>
        )}
      </div>
      {tab === 'users' && (from || to) && (
        <p className="reports-filter-meta">
          Showing only users with queue activity in the selected range.
        </p>
      )}

      {error && <div className="reports-error">{error}</div>}

      {showFilterHint && (
        <div className="reports-empty-hint">
          No data matches your active filters.
          <button className="reports-link-btn" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      {/* ===== Users tab ===== */}
      {tab === 'users' && usersData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Users — {usersData.count} record{usersData.count === 1 ? '' : 's'}
          </h3>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Total</th>
                  <th>Served</th>
                  <th>Cancelled</th>
                  <th>Waiting</th>
                  <th>Last Activity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usersData.data.map(u => (
                  <tr key={u.userId}>
                    <td>{u.userId}</td>
                    <td>{u.fullName || '—'}</td>
                    <td>{u.email}</td>
                    <td><span className={`reports-badge role-${u.role}`}>{u.role}</span></td>
                    <td>{u.totalEntries}</td>
                    <td>{u.served}</td>
                    <td>{u.cancelled}</td>
                    <td>{u.waiting}</td>
                    <td>{formatDate(u.lastActivity)}</td>
                    <td>
                      <button
                        className="reports-link-btn"
                        onClick={() => viewUserHistory(u.userId, u.fullName)}
                        disabled={u.totalEntries === 0}
                        title={u.totalEntries === 0 ? 'No history' : 'Open this user\'s queue history'}
                      >
                        History →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Services tab ===== */}
      {tab === 'services' && servicesData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Services — {servicesData.count} record{servicesData.count === 1 ? '' : 's'}
          </h3>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Duration</th>
                  <th>Priority</th>
                  <th>Open</th>
                  <th>Total</th>
                  <th>Served</th>
                  <th>Cancelled</th>
                  <th>Waiting</th>
                  <th>Walk-ins</th>
                </tr>
              </thead>
              <tbody>
                {servicesData.data.map(s => (
                  <tr key={s.serviceId}>
                    <td>{s.serviceId}</td>
                    <td>{s.name}</td>
                    <td>{s.expectedDuration} min</td>
                    <td><span className={`reports-badge priority-${s.priority}`}>{s.priority}</span></td>
                    <td>{s.isOpen ? 'Yes' : 'No'}</td>
                    <td>{s.totalEntries}</td>
                    <td>{s.served}</td>
                    <td>{s.cancelled}</td>
                    <td>{s.waiting}</td>
                    <td>{s.walkIns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Queue Stats tab ===== */}
      {tab === 'stats' && statsData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Queue Statistics
            {statsData.serviceId && (
              <span className="reports-scope">
                {' '}— scoped to service #{statsData.serviceId}
              </span>
            )}
          </h3>
          <div className="reports-stats-grid">
            <div className="reports-stat-card">
              <div className="reports-stat-label">Total Entries</div>
              <div className="reports-stat-value">{statsData.stats.totalEntries}</div>
            </div>
            <div className="reports-stat-card success">
              <div className="reports-stat-label">Served</div>
              <div className="reports-stat-value">{statsData.stats.served}</div>
              <div className="reports-stat-note">{statsData.stats.serveRate}% of total</div>
            </div>
            <div className="reports-stat-card danger">
              <div className="reports-stat-label">Cancelled</div>
              <div className="reports-stat-value">{statsData.stats.cancelled}</div>
              <div className="reports-stat-note">{statsData.stats.cancelRate}% of total</div>
            </div>
            <div className="reports-stat-card warn">
              <div className="reports-stat-label">Currently Waiting</div>
              <div className="reports-stat-value">{statsData.stats.waiting}</div>
              <div className="reports-stat-note">avg {statsData.stats.avgWaitSoFar} min so far</div>
            </div>
            <div className="reports-stat-card info">
              <div className="reports-stat-label">Avg Wait Until Served</div>
              <div className="reports-stat-value">{statsData.stats.avgWaitUntilServed} <span className="reports-stat-unit">min</span></div>
              <div className="reports-stat-note">
                {statsData.stats.servedWithData > 0
                  ? `based on ${statsData.stats.servedWithData} served entr${statsData.stats.servedWithData === 1 ? 'y' : 'ies'}`
                  : 'no served entries with timing data yet'}
              </div>
            </div>
            <div className="reports-stat-card">
              <div className="reports-stat-label">Walk-ins</div>
              <div className="reports-stat-value">{statsData.stats.walkIns}</div>
            </div>
            <div className="reports-stat-card">
              <div className="reports-stat-label">By Priority</div>
              <div className="reports-stat-pri">
                <span className="reports-badge priority-high">H {statsData.stats.highPriority}</span>
                <span className="reports-badge priority-medium">M {statsData.stats.mediumPriority}</span>
                <span className="reports-badge priority-low">L {statsData.stats.lowPriority}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Queue History tab ===== */}
      {tab === 'history' && historyData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Queue History — {historyData.count} record{historyData.count === 1 ? '' : 's'}
          </h3>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>User</th>
                  <th>Service</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Walk-in</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {historyData.data.map(h => (
                  <tr key={h.entryId}>
                    <td>#{h.entryId}</td>
                    <td>{h.userName || (h.userId ? `User ${h.userId}` : '—')}</td>
                    <td>{h.serviceName}</td>
                    <td><span className={`reports-badge priority-${h.priority}`}>{h.priority}</span></td>
                    <td><span className={`reports-badge status-${h.status}`}>{h.status}</span></td>
                    <td>{h.walkIn ? 'Yes' : 'No'}</td>
                    <td>{formatDate(h.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
