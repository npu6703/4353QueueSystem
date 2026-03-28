const request = require('supertest')
const app = require('../server')
const store = require('../store')

const ADMIN_HEADER = { role: 'admin' }

beforeEach(() => {
  store.services = [
    { id: 's1', name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
    { id: 's2', name: 'Takeaway', description: 'Quick pickup', expected: 10, priority: 'low', open: false },
  ]
  store.queue = {}
  store.history = []
  store.notifications = []
})

// ===== GET /api/services =====

describe('GET /api/services', () => {
  test('returns all services', async () => {
    const res = await request(app).get('/api/services')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].id).toBe('s1')
  })

  test('returns empty array when no services', async () => {
    store.services = []
    const res = await request(app).get('/api/services')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

// ===== GET /api/services/:id =====

describe('GET /api/services/:id', () => {
  test('returns a specific service', async () => {
    const res = await request(app).get('/api/services/s1')
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Dine-in')
    expect(res.body.priority).toBe('medium')
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app).get('/api/services/nonexistent')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

// ===== POST /api/admin/services =====

describe('POST /api/admin/services', () => {
  test('creates a service with valid data', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'VIP Lounge', description: 'Priority seating', expected: 20, priority: 'high', open: true })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('VIP Lounge')
    expect(res.body.priority).toBe('high')
    expect(res.body.id).toBeDefined()
    expect(store.services).toHaveLength(3)
  })

  test('defaults open to true when not provided', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'New Svc', description: 'Desc', expected: 15, priority: 'low' })

    expect(res.status).toBe(201)
    expect(res.body.open).toBe(true)
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
    expect(res.body.error).toMatch(/100/i)
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
    expect(res.body.error).toMatch(/480/i)
  })

  test('returns 400 when expected duration is below 1', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'Test', description: 'Desc', expected: 0, priority: 'low' })

    expect(res.status).toBe(400)
  })

  test('returns 400 for invalid priority', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set(ADMIN_HEADER)
      .send({ name: 'Test', description: 'Desc', expected: 10, priority: 'critical' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/priority/i)
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
  test('updates a service name', async () => {
    const res = await request(app)
      .put('/api/admin/services/s1')
      .set(ADMIN_HEADER)
      .send({ name: 'Updated Dine-in' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Dine-in')
    expect(res.body.description).toBe('Table service') // unchanged
  })

  test('updates multiple fields at once', async () => {
    const res = await request(app)
      .put('/api/admin/services/s1')
      .set(ADMIN_HEADER)
      .send({ expected: 45, priority: 'high', open: false })

    expect(res.status).toBe(200)
    expect(res.body.expected).toBe(45)
    expect(res.body.priority).toBe('high')
    expect(res.body.open).toBe(false)
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app)
      .put('/api/admin/services/doesnotexist')
      .set(ADMIN_HEADER)
      .send({ name: 'X' })

    expect(res.status).toBe(404)
  })

  test('returns 400 when name is empty string', async () => {
    const res = await request(app)
      .put('/api/admin/services/s1')
      .set(ADMIN_HEADER)
      .send({ name: '   ' })

    expect(res.status).toBe(400)
  })

  test('returns 400 when priority is invalid', async () => {
    const res = await request(app)
      .put('/api/admin/services/s1')
      .set(ADMIN_HEADER)
      .send({ priority: 'urgent' })

    expect(res.status).toBe(400)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).put('/api/admin/services/s1').send({ name: 'X' })
    expect(res.status).toBe(403)
  })
})

// ===== DELETE /api/admin/services/:id =====

describe('DELETE /api/admin/services/:id', () => {
  test('deletes a service', async () => {
    const res = await request(app)
      .delete('/api/admin/services/s1')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(store.services).toHaveLength(1)
    expect(store.services.find((s) => s.id === 's1')).toBeUndefined()
  })

  test('also clears the queue for the deleted service', async () => {
    store.queue['s1'] = [{ userId: 'u1', userName: 'Test', priority: 'low', joinedAt: new Date().toISOString() }]

    await request(app).delete('/api/admin/services/s1').set(ADMIN_HEADER)

    expect(store.queue['s1']).toBeUndefined()
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app).delete('/api/admin/services/ghost').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).delete('/api/admin/services/s1')
    expect(res.status).toBe(403)
  })
})

// ===== PUT /api/admin/services/:id/toggle =====

describe('PUT /api/admin/services/:id/toggle', () => {
  test('toggles an open service to closed', async () => {
    const res = await request(app)
      .put('/api/admin/services/s1/toggle')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.open).toBe(false) // s1 was open
  })

  test('toggles a closed service to open', async () => {
    const res = await request(app)
      .put('/api/admin/services/s2/toggle')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.open).toBe(true) // s2 was closed
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app).put('/api/admin/services/nope/toggle').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).put('/api/admin/services/s1/toggle')
    expect(res.status).toBe(403)
  })
})
