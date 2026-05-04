const request = require('supertest')
const app = require('../server')

// Mock the database module
jest.mock('../db', () => ({
  query: jest.fn(),
}))

// Mock the admin middleware so existing route-behavior tests don't have to
// also mock the auth-lookup query. The real middleware does a DB lookup;
// route tests assume that already passed.
jest.mock('../middleware/roleMiddleware', () => ({
  checkAdmin: (req, res, next) => {
    if (req.headers['role'] === 'admin') return next()
    return res.status(403).json({ success: false, message: 'Forbidden: admin access required' })
  },
}))

const db = require('../db')
const ADMIN_HEADER = { role: 'admin' }

beforeEach(() => {
  jest.clearAllMocks()
})

// ===== GET /api/admin/stats =====

describe('GET /api/admin/stats', () => {
  test('returns stats from database', async () => {
    db.query
      .mockResolvedValueOnce([[{ totalServices: 2 }]])
      .mockResolvedValueOnce([[{ openCount: 1 }]])
      .mockResolvedValueOnce([[{ closedCount: 1 }]])
      .mockResolvedValueOnce([[{ totalInQueue: 0 }]])
      .mockResolvedValueOnce([[{ todayServed: 0 }]])

    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.totalServices).toBe(2)
    expect(res.body.openCount).toBe(1)
    expect(res.body.closedCount).toBe(1)
    expect(res.body.totalInQueue).toBe(0)
    expect(res.body.todayServed).toBe(0)
  })

  test('counts people in queue', async () => {
    db.query
      .mockResolvedValueOnce([[{ totalServices: 2 }]])
      .mockResolvedValueOnce([[{ openCount: 2 }]])
      .mockResolvedValueOnce([[{ closedCount: 0 }]])
      .mockResolvedValueOnce([[{ totalInQueue: 3 }]])
      .mockResolvedValueOnce([[{ todayServed: 0 }]])

    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.totalInQueue).toBe(3)
  })

  test('counts today served', async () => {
    db.query
      .mockResolvedValueOnce([[{ totalServices: 2 }]])
      .mockResolvedValueOnce([[{ openCount: 1 }]])
      .mockResolvedValueOnce([[{ closedCount: 1 }]])
      .mockResolvedValueOnce([[{ totalInQueue: 0 }]])
      .mockResolvedValueOnce([[{ todayServed: 2 }]])

    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.todayServed).toBe(2)
  })

  test('returns 403 without admin role', async () => {
    const res = await request(app).get('/api/admin/stats')
    expect(res.status).toBe(403)
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).get('/api/admin/stats').set(ADMIN_HEADER)
    expect(res.status).toBe(500)
  })
})

// ===== GET /api/notifications =====

describe('GET /api/notifications', () => {
  test('returns empty array when no notifications', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app).get('/api/notifications?userId=1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('returns notifications for the requested user', async () => {
    db.query.mockResolvedValueOnce([[
      { notification_id: 1, user_id: 1, message: 'You are next', status: 'sent' },
      { notification_id: 2, user_id: 1, message: 'Almost your turn', status: 'viewed' },
    ]])

    const res = await request(app).get('/api/notifications?userId=1')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].message).toBe('You are next')
  })

  test('rejects requests without userId', async () => {
    const res = await request(app).get('/api/notifications')
    expect(res.status).toBe(400)
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).get('/api/notifications?userId=1')
    expect(res.status).toBe(500)
  })
})

// ===== PUT /api/notifications/read =====

describe('PUT /api/notifications/read', () => {
  test('marks all notifications as read', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 2 }])

    const res = await request(app).put('/api/notifications/read').send({ userId: 1 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('works with no unread notifications', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }])

    const res = await request(app).put('/api/notifications/read').send({ userId: 1 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('rejects requests without userId', async () => {
    const res = await request(app).put('/api/notifications/read').send({})
    expect(res.status).toBe(400)
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).put('/api/notifications/read').send({ userId: 1 })
    expect(res.status).toBe(500)
  })
})

// ===== DELETE /api/notifications =====

describe('DELETE /api/notifications', () => {
  test('clears all notifications for a user', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 3 }])

    const res = await request(app).delete('/api/notifications?userId=1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.deleted).toBe(3)
  })

  test('works when user has no notifications', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }])

    const res = await request(app).delete('/api/notifications?userId=1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.deleted).toBe(0)
  })

  test('rejects requests without userId', async () => {
    const res = await request(app).delete('/api/notifications')
    expect(res.status).toBe(400)
  })

  test('rejects invalid userId', async () => {
    const res = await request(app).delete('/api/notifications?userId=abc')
    expect(res.status).toBe(400)
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).delete('/api/notifications?userId=1')
    expect(res.status).toBe(500)
  })
})