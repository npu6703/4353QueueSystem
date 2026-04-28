const request = require('supertest')
const app = require('../server')

jest.mock('../db', () => ({ query: jest.fn() }))

jest.mock('../middleware/roleMiddleware', () => ({
  checkAdmin: (req, res, next) => {
    if (req.headers['role'] === 'admin') return next()
    return res.status(403).json({ success: false, message: 'Forbidden: admin access required' })
  },
}))

const db = require('../db')
const ADMIN_HEADER = { role: 'admin' }

beforeEach(() => jest.resetAllMocks())

// Helper to mock getQueueForService
function mockQueueForService(queueId, serviceId, entries = []) {
  db.query
    .mockResolvedValueOnce([[{ queue_id: queueId, service_id: serviceId, status: 'open' }]])
    .mockResolvedValueOnce([entries])
}

// ===== GET /api/admin/queues =====

describe('GET /api/admin/queues', () => {
  test('returns summary of all service queues', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
      { id: 2, name: 'Takeaway', description: 'Quick pickup', expected: 10, priority: 'low', open: true },
    ]])
    mockQueueForService(1, 1, [])
    mockQueueForService(2, 2, [])

    const res = await request(app).get('/api/admin/queues').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toHaveProperty('serviceId')
    expect(res.body[0]).toHaveProperty('count')
    expect(res.body[0]).toHaveProperty('next')
  })

  test('count reflects actual queue entries', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
    ]])
    mockQueueForService(1, 1, [
      { entry_id: 1, userId: 'u1', userName: 'Alice', priority: 'low', joinedAt: new Date().toISOString() },
      { entry_id: 2, userId: 'u2', userName: 'Bob', priority: 'medium', joinedAt: new Date().toISOString() },
    ])

    const res = await request(app).get('/api/admin/queues').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body[0].count).toBe(2)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/queues')
    expect(res.status).toBe(403)
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))
    const res = await request(app).get('/api/admin/queues').set(ADMIN_HEADER)
    expect(res.status).toBe(500)
  })
})

// ===== GET /api/admin/queues/:serviceId =====

describe('GET /api/admin/queues/:serviceId', () => {
  test('returns service and sorted queue', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true }
    ]])
    mockQueueForService(1, 1, [
      { entry_id: 1, userId: 'u1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString() },
      { entry_id: 2, userId: 'u2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString() },
    ])

    const res = await request(app).get('/api/admin/queues/1').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('service')
    expect(res.body).toHaveProperty('queue')
    expect(res.body.queue).toHaveLength(2)
  })

  test('queue entries include position, score, and expectedWait', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true }
    ]])
    mockQueueForService(1, 1, [
      { entry_id: 1, userId: 'u1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString() },
    ])

    const res = await request(app).get('/api/admin/queues/1').set(ADMIN_HEADER)

    const first = res.body.queue[0]
    expect(first).toHaveProperty('position')
    expect(first).toHaveProperty('score')
    expect(first).toHaveProperty('expectedWait')
    expect(first).toHaveProperty('waitedMinutes')
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])
    const res = await request(app).get('/api/admin/queues/999').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })
})

// ===== GET /api/admin/history =====

describe('GET /api/admin/history', () => {
  test('returns all served history', async () => {
    db.query.mockResolvedValueOnce([[
      { entry_id: 1, user_name: 'John', priority: 'medium', service_name: 'Dine-in', status: 'served' },
      { entry_id: 2, user_name: 'Jane', priority: 'low', service_name: 'Takeaway', status: 'served' },
    ]])

    const res = await request(app).get('/api/admin/history').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  test('returns empty array when no history', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app).get('/api/admin/history').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/history')
    expect(res.status).toBe(403)
  })
})

// ===== POST /api/admin/queues/:serviceId/serve =====

describe('POST /api/admin/queues/:serviceId/serve', () => {
  test('serves the next user in queue', async () => {
    db.query
      .mockResolvedValueOnce([[{ service_id: 1, name: 'Dine-in', expected: 30 }]])
    mockQueueForService(1, 1, [
      { entry_id: 1, userId: 'u1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString() },
    ])
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app).post('/api/admin/queues/1/serve').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('served')
  })

  test('returns 400 when queue is empty', async () => {
    db.query.mockResolvedValueOnce([[{ service_id: 1, name: 'Dine-in' }]])
    mockQueueForService(1, 1, [])

    const res = await request(app).post('/api/admin/queues/1/serve').set(ADMIN_HEADER)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/empty/i)
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])
    const res = await request(app).post('/api/admin/queues/999/serve').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).post('/api/admin/queues/1/serve')
    expect(res.status).toBe(403)
  })
})

// ===== POST /api/admin/queues/:serviceId/walkin =====

describe('POST /api/admin/queues/:serviceId/walkin', () => {
  test('adds a walk-in user to the queue', async () => {
    db.query.mockResolvedValueOnce([[{ service_id: 1, name: 'Dine-in', priority: 'medium' }]])
    mockQueueForService(1, 1, [])
    db.query.mockResolvedValueOnce([[{ maxPos: 0 }]]) // MAX(position) lookup
    db.query.mockResolvedValueOnce([{ insertId: 5 }])

    const res = await request(app)
      .post('/api/admin/queues/1/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'Walk In Bob', priority: 'medium' })

    expect(res.status).toBe(201)
    expect(res.body.user_name).toBe('Walk In Bob')
    expect(res.body.priority).toBe('medium')
    expect(res.body.walkIn).toBe(true)
  })

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/admin/queues/1/walkin')
      .set(ADMIN_HEADER)
      .send({ priority: 'low' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/name/i)
  })

  test('returns 400 when name exceeds 100 characters', async () => {
    const res = await request(app)
      .post('/api/admin/queues/1/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'B'.repeat(101) })
    expect(res.status).toBe(400)
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])
    const res = await request(app)
      .post('/api/admin/queues/999/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'Bob' })
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app)
      .post('/api/admin/queues/1/walkin')
      .send({ name: 'Bob' })
    expect(res.status).toBe(403)
  })
})

// ===== DELETE /api/admin/queues/:serviceId/remove/:userId =====

describe('DELETE /api/admin/queues/:serviceId/remove/:userId', () => {
  test('removes user from queue', async () => {
    db.query.mockResolvedValueOnce([[{ service_id: 1, name: 'Dine-in' }]])
    mockQueueForService(1, 1, [])
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .delete('/api/admin/queues/1/remove/1')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])
    const res = await request(app)
      .delete('/api/admin/queues/999/remove/1')
      .set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).delete('/api/admin/queues/1/remove/1')
    expect(res.status).toBe(403)
  })
})

// ===== PUT /api/admin/queues/:serviceId/priority/:userId =====

describe('PUT /api/admin/queues/:serviceId/priority/:userId', () => {
  test('changes user priority', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .put('/api/admin/queues/1/priority/1')
      .set(ADMIN_HEADER)
      .send({ priority: 'high' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('returns 400 for invalid priority', async () => {
    const res = await request(app)
      .put('/api/admin/queues/1/priority/1')
      .set(ADMIN_HEADER)
      .send({ priority: 'urgent' })
    expect(res.status).toBe(400)
  })

  test('returns 404 when user not found', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }])

    const res = await request(app)
      .put('/api/admin/queues/1/priority/999')
      .set(ADMIN_HEADER)
      .send({ priority: 'high' })
    expect(res.status).toBe(404)
  })
})

// ===== PUT /api/admin/queues/:serviceId/boost/:userId =====

describe('PUT /api/admin/queues/:serviceId/boost/:userId', () => {
  test('moves user up in queue', async () => {
    const now = new Date().toISOString()
    db.query
      .mockResolvedValueOnce([[{ queue_id: 1, service_id: 1, status: 'open' }]])
      .mockResolvedValueOnce([[
        { entry_id: 1, userId: 'u1', userName: 'John', priority: 'low', joinedAt: new Date(Date.now() - 60000).toISOString() },
        { entry_id: 2, userId: 'u2', userName: 'Jane', priority: 'low', joinedAt: now },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .put('/api/admin/queues/1/boost/2')
      .set(ADMIN_HEADER)
      .send({ amount: 5 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('returns 400 when already at top and moving up', async () => {
    db.query
      .mockResolvedValueOnce([[{ queue_id: 1, service_id: 1, status: 'open' }]])
      .mockResolvedValueOnce([[
        { entry_id: 1, userId: 'u1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString() },
      ]])

    const res = await request(app)
      .put('/api/admin/queues/1/boost/1')
      .set(ADMIN_HEADER)
      .send({ amount: 5 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/cannot move/i)
  })

  test('returns 404 when user not in queue', async () => {
    db.query
      .mockResolvedValueOnce([[{ queue_id: 1, service_id: 1, status: 'open' }]])
      .mockResolvedValueOnce([[
        { entry_id: 1, userId: 'u1', userName: 'John', priority: 'low', joinedAt: new Date().toISOString() },
      ]])

    const res = await request(app)
      .put('/api/admin/queues/1/boost/999')
      .set(ADMIN_HEADER)
      .send({ amount: 5 })

    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app)
      .put('/api/admin/queues/1/boost/1')
      .send({ amount: 5 })
    expect(res.status).toBe(403)
  })
})

// ===== PUT /api/admin/queues/:serviceId/movetotop/:userId =====

describe('PUT /api/admin/queues/:serviceId/movetotop/:userId', () => {
  test('moves user to top of queue', async () => {
    db.query
      .mockResolvedValueOnce([[{ queue_id: 1, service_id: 1, status: 'open' }]])
      .mockResolvedValueOnce([[
        { entry_id: 1, userId: 'u1', userName: 'John', priority: 'high', joinedAt: new Date(Date.now() - 60000).toISOString() },
        { entry_id: 2, userId: 'u2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString() },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .put('/api/admin/queues/1/movetotop/2')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('returns 400 when queue is empty', async () => {
    db.query
      .mockResolvedValueOnce([[{ queue_id: 1, service_id: 1, status: 'open' }]])
      .mockResolvedValueOnce([[]])

    const res = await request(app)
      .put('/api/admin/queues/1/movetotop/1')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/empty/i)
  })

  test('returns 404 when user not in queue', async () => {
    db.query
      .mockResolvedValueOnce([[{ queue_id: 1, service_id: 1, status: 'open' }]])
      .mockResolvedValueOnce([[
        { entry_id: 1, userId: 'u1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString() },
      ]])

    const res = await request(app)
      .put('/api/admin/queues/1/movetotop/999')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).put('/api/admin/queues/1/movetotop/1')
    expect(res.status).toBe(403)
  })
})