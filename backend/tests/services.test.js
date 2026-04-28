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

// ===== GET /api/services =====

describe('GET /api/services', () => {
  test('returns all services', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
      { id: 2, name: 'Takeaway', description: 'Quick pickup', expected: 10, priority: 'low', open: true },
    ]])

    const res = await request(app).get('/api/services')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].name).toBe('Dine-in')
  })

  test('returns empty array when no services', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app).get('/api/services')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).get('/api/services')
    expect(res.status).toBe(500)
  })
})

// ===== GET /api/services/:id =====

describe('GET /api/services/:id', () => {
  test('returns a specific service', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true }
    ]])

    const res = await request(app).get('/api/services/1')
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Dine-in')
    expect(res.body.priority).toBe('medium')
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app).get('/api/services/999')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

// ===== POST /api/admin/services =====

describe('POST /api/admin/services', () => {
  test('creates a service with valid data', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 3 }])

    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'VIP Lounge', description: 'Priority seating', expected: 20, priority: 'high' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('VIP Lounge')
    expect(res.body.id).toBe(3)
  })

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ description: 'Desc', expected: 10, priority: 'low' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/name/i)
  })

  test('returns 400 when name exceeds 100 characters', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'A'.repeat(101), description: 'Desc', expected: 10, priority: 'low' })

    expect(res.status).toBe(400)
  })

  test('returns 400 when description is missing', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'Test', expected: 10, priority: 'low' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/description/i)
  })

  test('returns 400 when expected duration is out of range', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'Test', description: 'Desc', expected: 999, priority: 'low' })

    expect(res.status).toBe(400)
  })

  test('returns 400 for invalid priority', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'Test', description: 'Desc', expected: 10, priority: 'urgent' })

    expect(res.status).toBe(400)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .send({ name: 'Test', description: 'Desc', expected: 10, priority: 'low' })

    expect(res.status).toBe(403)
  })
})

// ===== PUT /api/admin/services/:id =====

describe('PUT /api/admin/services/:id', () => {
  test('updates a service', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Dine-in', description: 'Table service', expected_duration: 30, priority: 'medium' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ id: 1, name: 'Updated Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true }]])

    const res = await request(app)
      .put('/api/admin/services/1')
      .set(ADMIN_HEADER)
      .send({ name: 'Updated Dine-in' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Dine-in')
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app)
      .put('/api/admin/services/999')
      .set(ADMIN_HEADER)
      .send({ name: 'Test' })

    expect(res.status).toBe(404)
  })

  test('returns 400 for invalid priority', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Dine-in', description: 'Table service', expected_duration: 30, priority: 'medium' }]])

    const res = await request(app)
      .put('/api/admin/services/1')
      .set(ADMIN_HEADER)
      .send({ priority: 'urgent' })

    expect(res.status).toBe(400)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).put('/api/admin/services/1').send({ name: 'Test' })
    expect(res.status).toBe(403)
  })
})

// ===== DELETE /api/admin/services/:id =====

describe('DELETE /api/admin/services/:id', () => {
  test('deletes a service', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Dine-in' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .delete('/api/admin/services/1')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app).delete('/api/admin/services/999').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).delete('/api/admin/services/1')
    expect(res.status).toBe(403)
  })
})

// ===== PUT /api/admin/services/:id/toggle =====

describe('PUT /api/admin/services/:id/toggle', () => {
  test('toggles service from open to closed', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Dine-in', is_open: true }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .put('/api/admin/services/1/toggle')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.open).toBe(false)
  })

  test('toggles service from closed to open', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Takeaway', is_open: false }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await request(app)
      .put('/api/admin/services/2/toggle')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.open).toBe(true)
  })

  test('returns 404 for unknown service', async () => {
    db.query.mockResolvedValueOnce([[]])

    const res = await request(app).put('/api/admin/services/999/toggle').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).put('/api/admin/services/1/toggle')
    expect(res.status).toBe(403)
  })
})