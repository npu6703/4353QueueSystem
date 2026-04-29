import { API_BASE as BASE } from '../config'

function currentUserId() {
  try {
    const raw = localStorage.getItem('qs_current') || sessionStorage.getItem('qs_current')
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.id != null ? String(parsed.id) : ''
  } catch {
    return ''
  }
}

function adminHeaders(includeJson = true) {
  const h = { role: 'admin', 'user-id': currentUserId() }
  if (includeJson) h['Content-Type'] = 'application/json'
  return h
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed')
  return data
}

// ===== Services =====

export async function getServices() {
  return request('/api/services')
}

export async function createService(data) {
  return request('/api/admin/services', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(data),
  })
}

export async function updateService(id, data) {
  return request(`/api/admin/services/${id}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(data),
  })
}

export async function deleteService(id) {
  return request(`/api/admin/services/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(false),
  })
}

export async function toggleService(id) {
  return request(`/api/admin/services/${id}/toggle`, {
    method: 'PUT',
    headers: adminHeaders(false),
  })
}

// ===== Admin Queue Management =====

export async function getAllQueues() {
  return request('/api/admin/queues', { headers: adminHeaders(false) })
}

export async function getQueue(serviceId) {
  return request(`/api/admin/queues/${serviceId}`, { headers: adminHeaders(false) })
}

export async function serveNext(serviceId) {
  return request(`/api/admin/queues/${serviceId}/serve`, {
    method: 'POST',
    headers: adminHeaders(false),
  })
}

export async function addWalkIn(serviceId, name, priority) {
  return request(`/api/admin/queues/${serviceId}/walkin`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name, priority }),
  })
}

export async function removeUser(serviceId, entryId) {
  return request(`/api/admin/queues/${serviceId}/remove/${entryId}`, {
    method: 'DELETE',
    headers: adminHeaders(false),
  })
}

export async function boostUser(serviceId, entryId, amount) {
  return request(`/api/admin/queues/${serviceId}/boost/${entryId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ amount }),
  })
}

export async function moveToTop(serviceId, entryId) {
  return request(`/api/admin/queues/${serviceId}/movetotop/${entryId}`, {
    method: 'PUT',
    headers: adminHeaders(false),
  })
}

export async function changePriority(serviceId, entryId, priority) {
  return request(`/api/admin/queues/${serviceId}/priority/${entryId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ priority }),
  })
}

// ===== Admin Stats & History =====

export async function getAdminStats() {
  return request('/api/admin/stats', { headers: adminHeaders(false) })
}

export async function getAdminHistory() {
  return request('/api/admin/history', { headers: adminHeaders(false) })
}

export async function getNotifications(userId) {
  const id = userId || currentUserId()
  return request(`/api/notifications?userId=${encodeURIComponent(id)}`, { headers: adminHeaders(false) })
}

export async function markNotificationsRead(userId) {
  const id = userId || currentUserId()
  return request('/api/notifications/read', {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ userId: id }),
  })
}

// ===== Reports =====

function buildQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, v)
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

export async function getUsersReport(params) {
  return request(`/api/admin/reports/users${buildQuery(params)}`, { headers: adminHeaders(false) })
}

export async function getServicesReport(params) {
  return request(`/api/admin/reports/services${buildQuery(params)}`, { headers: adminHeaders(false) })
}

export async function getQueueStatsReport(params) {
  return request(`/api/admin/reports/queue-stats${buildQuery(params)}`, { headers: adminHeaders(false) })
}

export async function getUserHistoryReport(params) {
  return request(`/api/admin/reports/user-history${buildQuery(params)}`, { headers: adminHeaders(false) })
}

/**
 * Download a report as CSV. Triggers a browser file save.
 * Uses fetch + blob so we can attach the admin headers, then synthesizes an
 * <a download> click to save the file.
 */
export async function downloadReportCsv(kind, params) {
  const path = `/api/admin/reports/${kind}${buildQuery({ ...params, format: 'csv' })}`
  const res = await fetch(`${BASE}${path}`, { headers: adminHeaders(false) })
  if (!res.ok) {
    let msg = 'Failed to download report'
    try { const j = await res.json(); msg = j.error || j.message || msg } catch { /* not JSON */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Pull filename out of Content-Disposition if present, else derive one.
  const cd = res.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/.exec(cd)
  a.download = match ? match[1] : `${kind}-report.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
