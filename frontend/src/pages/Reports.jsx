import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getUsersReport, getServicesReport, getQueueStatsReport, getUserHistoryReport,
  downloadReportCsv, getServices,
} from '../services/adminApi'
import '../styles/Reports.css'

const TABS = [
  { key: 'users',    label: 'Users',         kind: 'users' },
  { key: 'services', label: 'Services',      kind: 'services' },
  { key: 'stats',    label: 'Queue Stats',   kind: 'queue-stats' },
  { key: 'history',  label: 'Queue History', kind: 'user-history' },
]

const CHART_COLORS = {
  served:    '#10b981',
  cancelled: '#ef4444',
  waiting:   '#f59e0b',
  total:     '#3b82f6',
  high:      '#ef4444',
  medium:    '#f59e0b',
  low:       '#10b981',
}

function formatDate(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return String(value) }
}

function formatDay(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return String(value) }
}

// ── Custom tooltip shared across charts ──
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const [tab, setTab] = useState('users')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [historyUserId, setHistoryUserId] = useState('')
  const [historyUserName, setHistoryUserName] = useState('')
  const [services, setServices] = useState([])

  // New filter states
  const [filterRole, setFilterRole] = useState('')           // users tab
  const [filterStatus, setFilterStatus] = useState('')       // stats + history tabs
  const [filterPriority, setFilterPriority] = useState('')   // stats + history tabs
  const [filterWalkIn, setFilterWalkIn] = useState('')       // history tab

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCharts, setShowCharts] = useState(true)

  const [usersData, setUsersData] = useState(null)
  const [servicesData, setServicesData] = useState(null)
  const [statsData, setStatsData] = useState(null)
  const [historyData, setHistoryData] = useState(null)

  useEffect(() => {
    getServices().then(setServices).catch(() => setServices([]))
  }, [])

  // Reset extra filters when switching tabs
  useEffect(() => {
    setFilterRole('')
    setFilterStatus('')
    setFilterPriority('')
    setFilterWalkIn('')
  }, [tab])

  const filterParams = useCallback(() => {
    const p = {}
    if (from) p.from = from
    if (to)   p.to   = to
    return p
  }, [from, to])

  const generate = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'users') {
        const params = filterParams()
        if (filterRole) params.role = filterRole
        setUsersData(await getUsersReport(params))
      } else if (tab === 'services') {
        setServicesData(await getServicesReport(filterParams()))
      } else if (tab === 'stats') {
        const params = filterParams()
        if (serviceId)      params.serviceId = serviceId
        if (filterPriority) params.priority  = filterPriority
        if (filterStatus)   params.status    = filterStatus
        setStatsData(await getQueueStatsReport(params))
      } else if (tab === 'history') {
        const params = filterParams()
        if (historyUserId)  params.userId   = historyUserId
        if (filterStatus)   params.status   = filterStatus
        if (filterPriority) params.priority = filterPriority
        if (filterWalkIn)   params.walkIn   = filterWalkIn
        setHistoryData(await getUserHistoryReport(params))
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }, [tab, filterParams, serviceId, historyUserId, filterRole, filterStatus, filterPriority, filterWalkIn])

  useEffect(() => { generate() }, [tab, from, to, serviceId, historyUserId, filterRole, filterStatus, filterPriority, filterWalkIn]) // eslint-disable-line

  async function handleDownload() {
    setError('')
    try {
      const params = filterParams()
      const tabDef = TABS.find(t => t.key === tab)
      if (tab === 'stats'   && serviceId)     params.serviceId = serviceId
      if (tab === 'history' && historyUserId) params.userId    = historyUserId
      if (filterRole)     params.role     = filterRole
      if (filterStatus)   params.status   = filterStatus
      if (filterPriority) params.priority = filterPriority
      if (filterWalkIn)   params.walkIn   = filterWalkIn
      await downloadReportCsv(tabDef.kind, params)
    } catch (err) {
      setError(err.message || 'Failed to download report')
    }
  }

  function clearFilters() {
    setFrom(''); setTo(''); setServiceId('')
    setHistoryUserId(''); setHistoryUserName('')
    setFilterRole(''); setFilterStatus(''); setFilterPriority(''); setFilterWalkIn('')
  }

  function viewUserHistory(userId, fullName) {
    setHistoryUserId(String(userId))
    setHistoryUserName(fullName || `User ${userId}`)
    setTab('history')
  }

  const hasActiveFilters = !!(
    from || to ||
    (tab === 'stats'    && (serviceId || filterStatus || filterPriority)) ||
    (tab === 'users'    && filterRole) ||
    (tab === 'history'  && (historyUserId || filterStatus || filterPriority || filterWalkIn))
  )

  function isEmptyResult() {
    if (tab === 'users')    return usersData?.data?.every(u => u.totalEntries === 0)
    if (tab === 'services') return servicesData?.data?.every(s => s.totalEntries === 0)
    if (tab === 'history')  return (historyData?.count || 0) === 0
    if (tab === 'stats')    return (statsData?.stats?.totalEntries || 0) === 0
    return false
  }
  const showFilterHint = hasActiveFilters && isEmptyResult()

  // ── Chart data derivations ──
  const statsDonutData = statsData ? [
    { name: 'Served',    value: statsData.stats.served,    color: CHART_COLORS.served },
    { name: 'Cancelled', value: statsData.stats.cancelled, color: CHART_COLORS.cancelled },
    { name: 'Waiting',   value: statsData.stats.waiting,   color: CHART_COLORS.waiting },
  ].filter(d => d.value > 0) : []

  const statsPriorityData = statsData ? [
    { name: 'High',   value: statsData.stats.highPriority,   fill: CHART_COLORS.high },
    { name: 'Medium', value: statsData.stats.mediumPriority, fill: CHART_COLORS.medium },
    { name: 'Low',    value: statsData.stats.lowPriority,    fill: CHART_COLORS.low },
  ] : []

  const serviceBarData = servicesData?.data?.slice(0, 10).map(s => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    Served: s.served,
    Cancelled: s.cancelled,
    Waiting: s.waiting,
  })) || []

  const usersBarData = usersData?.data?.slice(0, 10).map(u => ({
    name: (u.fullName || u.email || `#${u.userId}`).split(' ')[0],
    Total: u.totalEntries,
    Served: u.served,
    Cancelled: u.cancelled,
  })) || []

  const trendData = statsData?.trend?.map(t => ({
    ...t,
    day: formatDay(t.day),
  })) || []

  // ── Shared filter row for Status + Priority (used in Stats + History) ──
  const showStatusFilter   = tab === 'stats' || tab === 'history'
  const showPriorityFilter = tab === 'stats' || tab === 'history'
  const showWalkInFilter   = tab === 'history'
  const showRoleFilter     = tab === 'users'
  const showServiceFilter  = tab === 'stats'
  const showUserHint       = tab === 'history' && !!historyUserId

  return (
    <div className="reports-page">
      {/* ── Header ── */}
      <div className="reports-header">
        <div>
          <h2>Reports</h2>
          <p className="reports-subtitle">Generate and export administrative reports.</p>
        </div>
        <div className="reports-actions">
          <button
            className="reports-btn reports-btn-ghost"
            onClick={() => setShowCharts(v => !v)}
          >
            {showCharts ? 'Hide Charts' : 'Show Charts'}
          </button>
          <button className="reports-btn reports-btn-outline" onClick={generate} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="reports-btn reports-btn-primary" onClick={handleDownload} disabled={loading}>
            Download CSV
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
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

      {/* ── Filters ── */}
      <div className="reports-filters">
        {/* Date range — all tabs */}
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>

        {/* Service — Stats tab */}
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

        {/* Role — Users tab */}
        {showRoleFilter && (
          <label>
            <span>Role</span>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </label>
        )}

        {/* Status — Stats + History tabs */}
        {showStatusFilter && (
          <label>
            <span>Status</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="served">Served</option>
              <option value="cancelled">Cancelled</option>
              <option value="waiting">Waiting</option>
            </select>
          </label>
        )}

        {/* Priority — Stats + History tabs */}
        {showPriorityFilter && (
          <label>
            <span>Priority</span>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        )}

        {/* Walk-in — History tab */}
        {showWalkInFilter && (
          <label>
            <span>Walk-in</span>
            <select value={filterWalkIn} onChange={e => setFilterWalkIn(e.target.value)}>
              <option value="">All</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </label>
        )}

        {/* User pill — History drilldown */}
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

      {/* ═══════════════════════════════════════════════════════
          Users tab
      ═══════════════════════════════════════════════════════ */}
      {tab === 'users' && usersData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Users — {usersData.count} record{usersData.count === 1 ? '' : 's'}
          </h3>

          {showCharts && usersBarData.length > 0 && (
            <div className="reports-chart-card">
              <p className="reports-chart-title">Top 10 Users by Activity</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={usersBarData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Total"     fill={CHART_COLORS.total}     radius={[4,4,0,0]} />
                  <Bar dataKey="Served"    fill={CHART_COLORS.served}    radius={[4,4,0,0]} />
                  <Bar dataKey="Cancelled" fill={CHART_COLORS.cancelled} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>User ID</th><th>Name</th><th>Email</th><th>Role</th>
                  <th>Total</th><th>Served</th><th>Cancelled</th><th>Waiting</th>
                  <th>Last Activity</th><th></th>
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
                        title={u.totalEntries === 0 ? 'No history' : "Open this user's queue history"}
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

      {/* ═══════════════════════════════════════════════════════
          Services tab
      ═══════════════════════════════════════════════════════ */}
      {tab === 'services' && servicesData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Services — {servicesData.count} record{servicesData.count === 1 ? '' : 's'}
          </h3>

          {showCharts && serviceBarData.length > 0 && (
            <div className="reports-chart-card">
              <p className="reports-chart-title">Entries per Service</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={serviceBarData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Served"    fill={CHART_COLORS.served}    radius={[4,4,0,0]} />
                  <Bar dataKey="Cancelled" fill={CHART_COLORS.cancelled} radius={[4,4,0,0]} />
                  <Bar dataKey="Waiting"   fill={CHART_COLORS.waiting}   radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Duration</th><th>Priority</th>
                  <th>Open</th><th>Total</th><th>Served</th><th>Cancelled</th>
                  <th>Waiting</th><th>Walk-ins</th>
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

      {/* ═══════════════════════════════════════════════════════
          Queue Stats tab
      ═══════════════════════════════════════════════════════ */}
      {tab === 'stats' && statsData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Queue Statistics
            {statsData.serviceId && (
              <span className="reports-scope"> — scoped to service #{statsData.serviceId}</span>
            )}
          </h3>

          {/* Stat cards */}
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
              <div className="reports-stat-value">
                {statsData.stats.avgWaitUntilServed} <span className="reports-stat-unit">min</span>
              </div>
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

          {/* Charts */}
          {showCharts && statsData.stats.totalEntries > 0 && (
            <div className="reports-charts-row">
              {/* Donut: Status breakdown */}
              {statsDonutData.length > 0 && (
                <div className="reports-chart-card reports-chart-half">
                  <p className="reports-chart-title">Status Breakdown</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statsDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statsDonutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bar: Priority breakdown */}
              <div className="reports-chart-card reports-chart-half">
                <p className="reports-chart-title">Priority Distribution</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={statsPriorityData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Entries" radius={[6,6,0,0]}>
                      {statsPriorityData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line: Daily trend */}
              {trendData.length > 1 && (
                <div className="reports-chart-card reports-chart-full">
                  <p className="reports-chart-title">Daily Entry Trend</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="total"     name="Total"     stroke={CHART_COLORS.total}     strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="served"    name="Served"    stroke={CHART_COLORS.served}    strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke={CHART_COLORS.cancelled} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Queue History tab
      ═══════════════════════════════════════════════════════ */}
      {tab === 'history' && historyData && (
        <div className="reports-section">
          <h3 className="reports-section-title">
            Queue History — {historyData.count} record{historyData.count === 1 ? '' : 's'}
          </h3>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Entry</th><th>User</th><th>Service</th>
                  <th>Priority</th><th>Status</th><th>Walk-in</th><th>Joined</th>
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