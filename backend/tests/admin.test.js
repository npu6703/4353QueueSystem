const request = require('supertest')
const app = require('../server')
const store = require('../store')

const ADMIN_HEADER = { role: 'admin' }

beforeEach(() => {
  store.services = [
    { id: 's1', name: 'Dine-in', description: 'Table service', expected: 10, priority: 'medium', open: true },
    { id: 's2', name: 'Takeaway', description: 'Quick pickup', expected: 5, priority: 'low', open: false },
  ]
  store.queue = {}
  store.history = []
  store.notifications = []
})

// ===== GET /api/admin/stats =====

describe('GET /api/admin/stats', () => {
  test('returns stats with empty queue and no history', async () => {
    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.totalServices).toBe(2)
    expect(res.body.openCount).toBe(1)
    expect(res.body.closedCount).toBe(1)
    expect(res.body.totalInQueue).toBe(0)
    expect(res.body.todayServed).toBe(0)
  })

  test('counts people across all queues', async () => {
    store.queue['s1'] = [
      { userId: 'u1', userName: 'Alice', priority: 'low', joinedAt: new Date().toISOString() },
      { userId: 'u2', userName: 'Bob', priority: 'medium', joinedAt: new Date().toISOString() },
    ]
    store.queue['s2'] = [
      { userId: 'u3', userName: 'Carol', priority: 'high', joinedAt: new Date().toISOString() },
    ]

    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.totalInQueue).toBe(3)
  })

  test('counts only today served in history', async () => {
    store.history = [
      { id: 'h1', date: new Date().toISOString(), outcome: 'served' },
      { id: 'h2', date: new Date().toISOString(), outcome: 'served' },
      { id: 'h3', date: new Date('2000-01-01').toISOString(), outcome: 'served' }, // old
    ]

    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.todayServed).toBe(2)
  })

  test('returns 403 without admin role', async () => {
    const res = await request(app).get('/api/admin/stats')
    expect(res.status).toBe(403)
  })
})

// ===== GET /api/notifications =====

describe('GET /api/notifications', () => {
  test('returns empty array when no notifications', async () => {
    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('returns all notifications', async () => {
    store.notifications = [
      { id: 'n1', read: false, message: 'You are next' },
      { id: 'n2', read: true, message: 'Almost your turn' },
    ]

    const res = await request(app).get('/api/notifications')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].id).toBe('n1')
  })
})

// ===== PUT /api/notifications/read =====

describe('PUT /api/notifications/read', () => {
  test('marks all notifications as read', async () => {
    store.notifications = [
      { id: 'n1', read: false, message: 'First' },
      { id: 'n2', read: false, message: 'Second' },
    ]

    const res = await request(app).put('/api/notifications/read')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(store.notifications.every(n => n.read)).toBe(true)
  })

  test('works with empty notifications list', async () => {
    const res = await request(app).put('/api/notifications/read')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('does not affect already-read notifications', async () => {
    store.notifications = [
      { id: 'n1', read: true, message: 'Already read' },
    ]

    await request(app).put('/api/notifications/read')

    expect(store.notifications[0].read).toBe(true)
  })
})
