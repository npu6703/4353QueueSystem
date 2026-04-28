const BASE = 'http://localhost:3001'

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

export async function removeUser(serviceId, userId) {
  return request(`/api/admin/queues/${serviceId}/remove/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(false),
  })
}

export async function boostUser(serviceId, userId, amount) {
  return request(`/api/admin/queues/${serviceId}/boost/${userId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ amount }),
  })
}

export async function moveToTop(serviceId, userId) {
  return request(`/api/admin/queues/${serviceId}/movetotop/${userId}`, {
    method: 'PUT',
    headers: adminHeaders(false),
  })
}

export async function changePriority(serviceId, userId, priority) {
  return request(`/api/admin/queues/${serviceId}/priority/${userId}`, {
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
