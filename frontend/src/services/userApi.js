import { API_BASE as BASE } from '../config'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export async function joinQueue(serviceId, userId, userName) {
  return request('/api/queue/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceId, userId, userName }),
  })
}

export async function leaveQueue(serviceId, userId) {
  return request('/api/queue/leave', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceId, userId }),
  })
}

export async function getQueueStatus(userId) {
  return request(`/api/queue/status?userId=${encodeURIComponent(userId)}`)
}

export async function getHistory(userId) {
  return request(`/api/history?userId=${encodeURIComponent(userId)}`)
}

export async function getServices() {
  return request('/api/services')
}

export async function getNotifications(userId) {
  return request(`/api/notifications?userId=${encodeURIComponent(userId)}`)
}

export async function markNotificationsRead(userId) {
  return request('/api/notifications/read', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}
