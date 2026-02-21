const STORAGE_KEYS = {
  USERS: 'qs_users',
  CURRENT: 'qs_current',
  SERVICES: 'qs_services',
  QUEUES: 'qs_queues',
  HISTORY: 'qs_history',
  NOTIFS: 'qs_notifs'
}

/* ===== Priority Queue Algorithm =====
 *
 * Weighted Priority with Aging — prevents starvation while respecting urgency.
 *
 * effective_score = PRIORITY_WEIGHT[priority] + (minutes_waiting * AGING_FACTOR)
 *
 * High-priority users start with a big head start (30 pts),
 * but low-priority users gain 1 pt/min, so after 30+ min they catch up.
 * Ties broken by arrival time (earlier = higher score).
 */
const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 }
const AGING_FACTOR = 1 // points per minute of waiting

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

// ===== Auth =====

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

// ===== Services =====

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

// ===== Queue Algorithm =====

/**
 * Calculate effective score for a queue entry.
 * Higher score = served sooner.
 */
export function calcEffectiveScore(entry) {
  const waited = (Date.now() - new Date(entry.joinedAt).getTime()) / 60000 // minutes
  return PRIORITY_WEIGHTS[entry.priority] + (waited * AGING_FACTOR)
}

/**
 * Get raw (unsorted) queue entries for a service.
 * Each entry: { userId, userName, priority, joinedAt }
 */
export function getQueueForService(serviceId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) queues[serviceId] = []
  // Migrate old format (plain user ID strings) to new entry objects
  const migrated = queues[serviceId].map(entry => {
    if (typeof entry === 'string') {
      return { userId: entry, userName: entry, priority: 'low', joinedAt: new Date().toISOString() }
    }
    return entry
  })
  return migrated
}

/**
 * Get queue sorted by effective score (highest first = served next).
 * This is the "real" order users see.
 */
export function getSortedQueue(serviceId) {
  const entries = getQueueForService(serviceId)
  return [...entries].sort((a, b) => {
    const scoreA = calcEffectiveScore(a)
    const scoreB = calcEffectiveScore(b)
    if (scoreB !== scoreA) return scoreB - scoreA // higher score first
    return new Date(a.joinedAt) - new Date(b.joinedAt) // earlier arrival breaks ties
  })
}

/**
 * Join a queue with a chosen priority level.
 */
export function joinQueue(serviceId, userId, priority) {
  const svc = getServices().find(s => s.id === serviceId)
  if (svc && !svc.open) throw new Error('This service is currently closed')

  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) queues[serviceId] = []

  // Prevent duplicate joins to same service
  if (queues[serviceId].some(e => (typeof e === 'string' ? e : e.userId) === userId)) return

  const users = read(STORAGE_KEYS.USERS, [])
  const user = users.find(u => u.id === userId)

  const entry = {
    userId,
    userName: user?.name || userId,
    priority: priority || svc?.priority || 'low',
    joinedAt: new Date().toISOString()
  }

  queues[serviceId].push(entry)
  write(STORAGE_KEYS.QUEUES, queues)
  addNotif({ type: 'joined', message: `You joined ${svc?.name || serviceId} queue (${entry.priority} priority)` })
}

/**
 * Admin: add a walk-in person to the queue (no account required).
 */
export function adminAddToQueue(serviceId, name, priority, phone, notes) {
  const svc = getServices().find(s => s.id === serviceId)
  if (svc && !svc.open) throw new Error('Cannot add to a closed service queue')

  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) queues[serviceId] = []
  const entry = {
    userId: 'walkin_' + Date.now(),
    userName: name,
    priority: priority || 'low',
    joinedAt: new Date().toISOString(),
    walkIn: true,
    phone: phone || '',
    notes: notes || ''
  }
  queues[serviceId].push(entry)
  write(STORAGE_KEYS.QUEUES, queues)
  addNotif({ type: 'admin_add', message: `Admin added ${name} to ${svc?.name || serviceId} queue (${entry.priority})` })
  return entry
}

export function leaveQueue(serviceId, userId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) return
  const svc = getServices().find(s => s.id === serviceId)
  queues[serviceId] = queues[serviceId].filter(e => (typeof e === 'string' ? e : e.userId) !== userId)
  write(STORAGE_KEYS.QUEUES, queues)
  addNotif({ type: 'left', message: `You left ${svc?.name || serviceId} queue` })
}

/**
 * Serve the person with the highest effective score (top of sorted queue).
 */
export function serveNext(serviceId) {
  const sorted = getSortedQueue(serviceId)
  if (sorted.length === 0) return null

  const next = sorted[0] // highest score = first to serve
  const svc = getServices().find(s => s.id === serviceId)

  // Remove this entry from the raw queue
  const queues = read(STORAGE_KEYS.QUEUES, {})
  queues[serviceId] = queues[serviceId].filter(e =>
    (typeof e === 'string' ? e : e.userId) !== next.userId
  )
  write(STORAGE_KEYS.QUEUES, queues)

  // Record in history
  const history = read(STORAGE_KEYS.HISTORY, [])
  history.push({
    id: 'h' + Date.now(),
    userId: next.userId,
    userName: next.userName,
    serviceId,
    serviceName: svc?.name || serviceId,
    priority: next.priority,
    joinedAt: next.joinedAt,
    servedAt: new Date().toISOString(),
    date: new Date().toISOString(),
    outcome: 'served'
  })
  write(STORAGE_KEYS.HISTORY, history)

  addNotif({ type: 'served', message: `${next.userName} served for ${svc?.name || serviceId}` })

  // Notify people who are now close to being served
  const updatedSorted = getSortedQueue(serviceId)
  updatedSorted.slice(0, 2).forEach((entry, i) => {
    addNotif({
      type: 'almost_ready',
      message: i === 0
        ? `${entry.userName}: You are NEXT for ${svc?.name || serviceId}!`
        : `${entry.userName}: Almost your turn for ${svc?.name || serviceId} (position #2)`
    })
  })

  return next
}

/**
 * Get a user's queue status across all services (sorted position).
 */
export function getUserQueueStatus(userId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  for (const serviceId of Object.keys(queues)) {
    const sorted = getSortedQueue(serviceId)
    const idx = sorted.findIndex(e => e.userId === userId)
    if (idx >= 0) {
      const entry = sorted[idx]
      const svc = getServices().find(s => s.id === serviceId)
      return {
        serviceId,
        serviceName: svc?.name || serviceId,
        position: idx + 1,
        total: sorted.length,
        priority: entry.priority,
        joinedAt: entry.joinedAt,
        score: calcEffectiveScore(entry).toFixed(1),
        expectedWait: (idx) * (svc?.expected || 10) // people ahead * service time
      }
    }
  }
  return null
}

/**
 * Remove a specific user from a service's queue (admin action).
 */
export function removeFromQueue(serviceId, userId) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) return
  queues[serviceId] = queues[serviceId].filter(e => (typeof e === 'string' ? e : e.userId) !== userId)
  write(STORAGE_KEYS.QUEUES, queues)
}

/**
 * Admin: swap a user with the person directly above or below in the sorted queue.
 * direction > 0 = move up (swap with person above), direction < 0 = move down (swap with person below)
 * Swaps both joinedAt and priority so the two entries fully trade positions.
 */
export function boostUser(serviceId, userId, direction) {
  const sorted = getSortedQueue(serviceId)
  const idx = sorted.findIndex(e => e.userId === userId)
  if (idx < 0) return

  const targetIdx = direction > 0 ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= sorted.length) return

  // Find the actual entries in the raw queue and swap their scoring fields
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) return
  const entryA = queues[serviceId].find(e => e.userId === sorted[idx].userId)
  const entryB = queues[serviceId].find(e => e.userId === sorted[targetIdx].userId)
  if (!entryA || !entryB) return

  // Swap joinedAt and priority — everything that affects score
  const tempJoined = entryA.joinedAt
  const tempPriority = entryA.priority
  entryA.joinedAt = entryB.joinedAt
  entryA.priority = entryB.priority
  entryB.joinedAt = tempJoined
  entryB.priority = tempPriority

  write(STORAGE_KEYS.QUEUES, queues)
}

/**
 * Admin: move user to the very top of the queue (emergency override).
 * Swaps joinedAt and priority with the current #1 entry so they fully trade positions.
 */
export function moveToTop(serviceId, userId) {
  const sorted = getSortedQueue(serviceId)
  if (sorted.length === 0) return
  // If user is already #1, nothing to do
  if (sorted[0].userId === userId) return

  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) return
  const entry = queues[serviceId].find(e => (typeof e === 'string' ? false : e.userId === userId))
  const topEntry = queues[serviceId].find(e => (typeof e === 'string' ? false : e.userId === sorted[0].userId))
  if (!entry || !topEntry) return

  // Swap joinedAt and priority with the #1 person
  const tempJoined = entry.joinedAt
  const tempPriority = entry.priority
  entry.joinedAt = topEntry.joinedAt
  entry.priority = topEntry.priority
  topEntry.joinedAt = tempJoined
  topEntry.priority = tempPriority

  write(STORAGE_KEYS.QUEUES, queues)
}

/**
 * Admin: change a user's priority level in the queue.
 */
export function changeUserPriority(serviceId, userId, newPriority) {
  const queues = read(STORAGE_KEYS.QUEUES, {})
  if (!queues[serviceId]) return
  const entry = queues[serviceId].find(e => (typeof e === 'string' ? false : e.userId === userId))
  if (!entry) return
  entry.priority = newPriority
  write(STORAGE_KEYS.QUEUES, queues)
}

export function getHistoryForUser(userId) {
  const history = read(STORAGE_KEYS.HISTORY, [])
  return history.filter(h => h.userId === userId)
}

export function getAllHistory() {
  return read(STORAGE_KEYS.HISTORY, [])
}

// ===== Notifications =====

export function getNotifications() {
  return read(STORAGE_KEYS.NOTIFS, [])
}

export function addNotif(n) {
  const arr = read(STORAGE_KEYS.NOTIFS, [])
  arr.unshift({ id: 'n' + Date.now() + Math.random(), read: false, ...n })
  write(STORAGE_KEYS.NOTIFS, arr)
}

export function markNotifsRead() {
  const arr = read(STORAGE_KEYS.NOTIFS, [])
  arr.forEach(n => n.read = true)
  write(STORAGE_KEYS.NOTIFS, arr)
}

// ===== Constants export for UI =====
export const PRIORITIES = PRIORITY_WEIGHTS

export default {
  register, login, logout, getCurrentUser, getServices, saveService, deleteService,
  getQueueForService, getSortedQueue, joinQueue, adminAddToQueue, leaveQueue, serveNext,
  getUserQueueStatus, removeFromQueue, boostUser, moveToTop, changeUserPriority,
  calcEffectiveScore, getHistoryForUser, getAllHistory,
  getNotifications, addNotif, markNotifsRead, PRIORITIES
}
