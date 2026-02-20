const STORAGE_KEYS = {
  USERS: 'qs_users',
  CURRENT: 'qs_current',
  SERVICES: 'qs_services',
  QUEUES: 'qs_queues',
  HISTORY: 'qs_history',
  NOTIFS: 'qs_notifs'
}

function read(key, init) {
  const raw = localStorage.getItem(key)
  if (!raw) return init
  try {
    return JSON.parse(raw)
  } catch {
    return init
  }
}

function write(key, v) {
  localStorage.setItem(key, JSON.stringify(v))
}

function ensureDefaults() {
  if (!read(STORAGE_KEYS.SERVICES, null)) {
    write(STORAGE_KEYS.SERVICES, [
      { id: 's1', name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
      { id: 's2', name: 'Takeaway', description: 'Quick pickup', expected: 10, priority: 'low', open: true }
    ])
  }
  if (!read(STORAGE_KEYS.QUEUES, null)) write(STORAGE_KEYS.QUEUES, {})
  if (!read(STORAGE_KEYS.USERS, null)) write(STORAGE_KEYS.USERS, [
    { id: 'admin1', email: 'admin@queue.com', password: 'admin123', name: 'Admin', isAdmin: true },
    { id: 'user1', email: 'user@queue.com', password: 'user123', name: 'John Doe', isAdmin: false }
  ])
  if (!read(STORAGE_KEYS.HISTORY, null)) write(STORAGE_KEYS.HISTORY, [])
  if (!read(STORAGE_KEYS.NOTIFS, null)) write(STORAGE_KEYS.NOTIFS, [])
}

ensureDefaults()

export function register({ email, password, name, isAdmin=false }) {
  const users = read(STORAGE_KEYS.USERS, [])
  if (users.find(u => u.email === email)) throw new Error('Email exists')
  const user = { id: 'u' + Date.now(), email, password, name, isAdmin }
  users.push(user)
  write(STORAGE_KEYS.USERS, users)
  write(STORAGE_KEYS.CURRENT, user)
  return user
}

export function login({ email, password }) {
  const users = read(STORAGE_KEYS.USERS, [])
  const user = users.find(u => u.email === email && u.password === password)
  if (!user) throw new Error('Invalid credentials')
  write(STORAGE_KEYS.CURRENT, user)
  return user
}

export function logout() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT)
}

export function getCurrentUser() {
  return read(STORAGE_KEYS.CURRENT, null)
}

export function getServices() {
  return read(STORAGE_KEYS.SERVICES, [])
}

export function saveService(svc) {
  const services = getServices()
  if (svc.id) {
    const idx = services.findIndex(s => s.id === svc.id)
    if (idx >= 0) services[idx] = svc
  } else {
    svc.id = 's' + Date.now()
    services.push(svc)
  }
  write(STORAGE_KEYS.SERVICES, services)
  return svc
}

export function deleteService(serviceId) {
  const services = getServices().filter(s => s.id !== serviceId)
  write(STORAGE_KEYS.SERVICES, services)
  const queues = read(STORAGE_KEYS.QUEUES, {})
  delete queues[serviceId]
  write(STORAGE_KEYS.QUEUES, queues)
}

export function getQueueForService(serviceId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) queues[serviceId] = []
  return queues[serviceId]
}

export function joinQueue(serviceId, userId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) queues[serviceId] = []
  const q = queues[serviceId]
  if (!q.includes(userId)) q.push(userId)
  write(STORAGE_KEYS.QUEUES, queues)
  addNotif({ type: 'joined', message: `You joined ${serviceId}` })
}

export function leaveQueue(serviceId, userId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) return
  queues[serviceId] = queues[serviceId].filter(id => id !== userId)
  write(STORAGE_KEYS.QUEUES, queues)
  addNotif({ type: 'left', message: `You left ${serviceId}` })
}

export function serveNext(serviceId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  const services = getServices()
  const svc = services.find(s => s.id === serviceId)
  if (!queues[serviceId] || queues[serviceId].length === 0) return null
  const next = queues[serviceId].shift()
  write(STORAGE_KEYS.QUEUES, queues)
  const history = read(STORAGE_KEYS.HISTORY, [])
  history.push({ id: 'h' + Date.now(), userId: next, serviceId, date: new Date().toISOString(), outcome: 'served' })
  write(STORAGE_KEYS.HISTORY, history)
  addNotif({ type: 'served', message: `User ${next} served for ${svc?.name || serviceId}` })
  return next
}

export function getUserQueueStatus(userId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  for (const [serviceId, arr] of Object.entries(queues)) {
    const pos = arr.indexOf(userId)
    if (pos >= 0) return { serviceId, position: pos + 1 }
  }
  return null
}

export function getHistoryForUser(userId) {
  const history = read(STORAGE_KEYS.HISTORY, [])
  return history.filter(h => h.userId === userId)
}

export function getNotifications() {
  return read(STORAGE_KEYS.NOTIFS, [])
}

export function addNotif(n) {
  const arr = read(STORAGE_KEYS.NOTIFS, [])
  arr.unshift({ id: 'n' + Date.now(), read: false, ...n })
  write(STORAGE_KEYS.NOTIFS, arr)
}

export function markNotifsRead() {
  const arr = read(STORAGE_KEYS.NOTIFS, [])
  arr.forEach(n => n.read = true)
  write(STORAGE_KEYS.NOTIFS, arr)
}

export default {
  register, login, logout, getCurrentUser, getServices, saveService, deleteService,
  getQueueForService, joinQueue, leaveQueue, serveNext, getUserQueueStatus,
  getHistoryForUser, getNotifications, addNotif, markNotifsRead
}