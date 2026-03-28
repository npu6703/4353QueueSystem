const BASE = 'http://localhost:3001'
const ADMIN_HEADERS = { 'Content-Type': 'application/json', role: 'admin' }
const ADMIN_GET_HEADERS = { role: 'admin' }

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ===== Services =====

export async function getServices() {
  return request('/api/services')
}

export async function createService(data) {
  return request('/api/admin/services', {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(data),
  })
}

export async function updateService(id, data) {
  return request(`/api/admin/services/${id}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(data),
  })
}

export async function deleteService(id) {
  return request(`/api/admin/services/${id}`, {
    method: 'DELETE',
    headers: ADMIN_HEADERS,
  })
}

export async function toggleService(id) {
  return request(`/api/admin/services/${id}/toggle`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
  })
}

// ===== Admin Queue Management =====

export async function getAllQueues() {
  return request('/api/admin/queues', { headers: ADMIN_GET_HEADERS })
}

export async function getQueue(serviceId) {
  return request(`/api/admin/queues/${serviceId}`, { headers: ADMIN_GET_HEADERS })
}

export async function serveNext(serviceId) {
  return request(`/api/admin/queues/${serviceId}/serve`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
  })
}

export async function addWalkIn(serviceId, name, priority) {
  return request(`/api/admin/queues/${serviceId}/walkin`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ name, priority }),
  })
}

export async function removeUser(serviceId, userId) {
  return request(`/api/admin/queues/${serviceId}/remove/${userId}`, {
    method: 'DELETE',
    headers: ADMIN_HEADERS,
  })
}

export async function boostUser(serviceId, userId, amount) {
  return request(`/api/admin/queues/${serviceId}/boost/${userId}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ amount }),
  })
}

export async function moveToTop(serviceId, userId) {
  return request(`/api/admin/queues/${serviceId}/movetotop/${userId}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
  })
}

export async function changePriority(serviceId, userId, priority) {
  return request(`/api/admin/queues/${serviceId}/priority/${userId}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ priority }),
  })
}

// ===== Admin Stats & History =====

export async function getAdminStats() {
  return request('/api/admin/stats', { headers: ADMIN_GET_HEADERS })
}

export async function getAdminHistory() {
  return request('/api/admin/history', { headers: ADMIN_GET_HEADERS })
}

export async function getNotifications() {
  return request('/api/notifications', { headers: ADMIN_GET_HEADERS })
}

export async function markNotificationsRead() {
  return request('/api/notifications/read', { method: 'PUT', headers: ADMIN_HEADERS })
}
