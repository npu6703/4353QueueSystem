const request = require('supertest')
const app = require('../server')
const store = require('../store')

const ADMIN_HEADER = { role: 'admin' }

beforeEach(() => {
  store.users = [
    { id: 'user1', email: 'user@queue.com', password: 'user123', name: 'John Doe', isAdmin: false },
    { id: 'user2', email: 'user2@queue.com', password: 'pass123', name: 'Jane Smith', isAdmin: false },
  ]
  store.services = [
    { id: 's1', name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
    { id: 's2', name: 'Takeaway', description: 'Quick pickup', expected: 10, priority: 'low', open: true },
  ]
  store.queue = {}
  store.history = []
  store.notifications = []
})

// ===== GET /api/admin/queues =====

describe('GET /api/admin/queues', () => {
  test('returns a summary of all service queues', async () => {
    const res = await request(app).get('/api/admin/queues').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toHaveProperty('serviceId')
    expect(res.body[0]).toHaveProperty('count')
    expect(res.body[0]).toHaveProperty('next')
  })

  test('count reflects actual queue length', async () => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'low', joinedAt: new Date().toISOString() },
      { userId: 'user2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString() },
    ]
    const res = await request(app).get('/api/admin/queues').set(ADMIN_HEADER)
    const s1Summary = res.body.find((s) => s.serviceId === 's1')
    expect(s1Summary.count).toBe(2)
    expect(s1Summary.next.userId).toBe('user1')
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/queues')
    expect(res.status).toBe(403)
  })
})

// ===== GET /api/admin/queues/:serviceId =====

describe('GET /api/admin/queues/:serviceId', () => {
  beforeEach(() => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString(), boost: 0 },
      { userId: 'user2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString(), boost: 0 },
    ]
  })

  test('returns service and sorted queue', async () => {
    const res = await request(app).get('/api/admin/queues/s1').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('service')
    expect(res.body).toHaveProperty('queue')
    expect(res.body.queue).toHaveLength(2)
  })

  test('queue entries include position, score, and expectedWait', async () => {
    const res = await request(app).get('/api/admin/queues/s1').set(ADMIN_HEADER)
    const first = res.body.queue[0]
    expect(first).toHaveProperty('position')
    expect(first).toHaveProperty('score')
    expect(first).toHaveProperty('expectedWait')
    expect(first).toHaveProperty('waitedMinutes')
  })

  test('high priority user is ranked first', async () => {
    const res = await request(app).get('/api/admin/queues/s1').set(ADMIN_HEADER)
    expect(res.body.queue[0].userId).toBe('user1') // high > low
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app).get('/api/admin/queues/ghost').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })
})

// ===== GET /api/admin/history =====

describe('GET /api/admin/history', () => {
  beforeEach(() => {
    store.history = [
      { id: 'h1', userId: 'user1', userName: 'John', serviceId: 's1', serviceName: 'Dine-in', outcome: 'served', date: new Date().toISOString() },
      { id: 'h2', userId: 'user2', userName: 'Jane', serviceId: 's2', serviceName: 'Takeaway', outcome: 'served', date: new Date().toISOString() },
    ]
  })

  test('returns all history for admin', async () => {
    const res = await request(app).get('/api/admin/history').set(ADMIN_HEADER)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/history')
    expect(res.status).toBe(403)
  })
})

// ===== POST /api/admin/queues/:serviceId/serve =====

describe('POST /api/admin/queues/:serviceId/serve', () => {
  beforeEach(() => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'high', joinedAt: new Date().toISOString(), boost: 0 },
      { userId: 'user2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString(), boost: 0 },
    ]
  })

  test('serves the highest-scored user', async () => {
    const res = await request(app).post('/api/admin/queues/s1/serve').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.served.userId).toBe('user1') // high priority
    expect(store.queue['s1']).toHaveLength(1)
    expect(store.queue['s1'][0].userId).toBe('user2')
  })

  test('adds a history record after serving', async () => {
    await request(app).post('/api/admin/queues/s1/serve').set(ADMIN_HEADER)

    expect(store.history).toHaveLength(1)
    expect(store.history[0].outcome).toBe('served')
    expect(store.history[0].userId).toBe('user1')
  })

  test('notifies the next person in line', async () => {
    await request(app).post('/api/admin/queues/s1/serve').set(ADMIN_HEADER)

    const almostNotifs = store.notifications.filter((n) => n.type === 'almost')
    expect(almostNotifs.length).toBeGreaterThanOrEqual(1)
  })

  test('returns 400 when queue is empty', async () => {
    store.queue['s1'] = []
    const res = await request(app).post('/api/admin/queues/s1/serve').set(ADMIN_HEADER)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/empty/i)
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app).post('/api/admin/queues/ghost/serve').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).post('/api/admin/queues/s1/serve')
    expect(res.status).toBe(403)
  })
})

// ===== POST /api/admin/queues/:serviceId/walkin =====

describe('POST /api/admin/queues/:serviceId/walkin', () => {
  test('adds a walk-in user to the queue', async () => {
    const res = await request(app)
      .post('/api/admin/queues/s1/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'Walk In Bob', priority: 'medium' })

    expect(res.status).toBe(201)
    expect(res.body.userName).toBe('Walk In Bob')
    expect(res.body.priority).toBe('medium')
    expect(res.body.walkIn).toBe(true)
    expect(res.body.userId).toMatch(/^walkin_/)
    expect(store.queue['s1']).toHaveLength(1)
  })

  test('uses service default priority when none provided', async () => {
    const res = await request(app)
      .post('/api/admin/queues/s1/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'Bob' })

    expect(res.status).toBe(201)
    expect(res.body.priority).toBe('medium') // s1 default
  })

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/admin/queues/s1/walkin')
      .set(ADMIN_HEADER)
      .send({ priority: 'low' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/name/i)
  })

  test('returns 400 when name exceeds 100 characters', async () => {
    const res = await request(app)
      .post('/api/admin/queues/s1/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'B'.repeat(101) })

    expect(res.status).toBe(400)
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app)
      .post('/api/admin/queues/ghost/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'Bob' })

    expect(res.status).toBe(404)
  })

  test('fires a walkin notification', async () => {
    await request(app)
      .post('/api/admin/queues/s1/walkin')
      .set(ADMIN_HEADER)
      .send({ name: 'Alice' })

    expect(store.notifications[0].type).toBe('walkin')
  })
})

// ===== DELETE /api/admin/queues/:serviceId/remove/:userId =====

describe('DELETE /api/admin/queues/:serviceId/remove/:userId', () => {
  beforeEach(() => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'low', joinedAt: new Date().toISOString() },
      { userId: 'user2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString() },
    ]
  })

  test('removes the specified user from queue', async () => {
    const res = await request(app)
      .delete('/api/admin/queues/s1/remove/user1')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.removed).toBe(true)
    expect(store.queue['s1']).toHaveLength(1)
    expect(store.queue['s1'][0].userId).toBe('user2')
  })

  test('returns removed:false when user was not in queue', async () => {
    const res = await request(app)
      .delete('/api/admin/queues/s1/remove/nonexistent')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.removed).toBe(false)
  })

  test('returns 404 for unknown service', async () => {
    const res = await request(app)
      .delete('/api/admin/queues/ghost/remove/user1')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(404)
  })
})

// ===== PUT /api/admin/queues/:serviceId/boost/:userId =====

describe('PUT /api/admin/queues/:serviceId/boost/:userId', () => {
  beforeEach(() => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'low', joinedAt: new Date().toISOString(), boost: 0 },
    ]
  })

  test('increases boost by the given amount', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/boost/user1')
      .set(ADMIN_HEADER)
      .send({ amount: 20 })

    expect(res.status).toBe(200)
    expect(store.queue['s1'][0].boost).toBe(20)
  })

  test('stacks boosts on repeated calls', async () => {
    await request(app).put('/api/admin/queues/s1/boost/user1').set(ADMIN_HEADER).send({ amount: 10 })
    await request(app).put('/api/admin/queues/s1/boost/user1').set(ADMIN_HEADER).send({ amount: 5 })

    expect(store.queue['s1'][0].boost).toBe(15)
  })

  test('applies exactly 0 when amount is 0 (no default fallback)', async () => {
    await request(app).put('/api/admin/queues/s1/boost/user1').set(ADMIN_HEADER).send({ amount: 0 })
    expect(store.queue['s1'][0].boost).toBe(0)
  })

  test('returns 404 when user not in queue', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/boost/nobody')
      .set(ADMIN_HEADER)
      .send({ amount: 10 })

    expect(res.status).toBe(404)
  })
})

// ===== PUT /api/admin/queues/:serviceId/movetotop/:userId =====

describe('PUT /api/admin/queues/:serviceId/movetotop/:userId', () => {
  beforeEach(() => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'high', joinedAt: new Date(Date.now() - 60000).toISOString(), boost: 0 },
      { userId: 'user2', userName: 'Jane', priority: 'low', joinedAt: new Date().toISOString(), boost: 0 },
    ]
  })

  test('moves a lower-ranked user to the top', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/movetotop/user2')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify user2 now has a higher score than user1
    const queue = store.queue['s1']
    const user1 = queue.find((e) => e.userId === 'user1')
    const user2 = queue.find((e) => e.userId === 'user2')
    expect(user2.boost).toBeGreaterThan(0)
    // user2's effective score should now exceed user1's
    const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 }
    const score1 = PRIORITY_WEIGHTS[user1.priority] + (user1.boost || 0)
    const score2 = PRIORITY_WEIGHTS[user2.priority] + (user2.boost || 0)
    expect(score2).toBeGreaterThan(score1)
  })

  test('returns 404 when user not in queue', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/movetotop/nobody')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(404)
  })
})

// ===== PUT /api/admin/queues/:serviceId/priority/:userId =====

describe('PUT /api/admin/queues/:serviceId/priority/:userId', () => {
  beforeEach(() => {
    store.queue['s1'] = [
      { userId: 'user1', userName: 'John', priority: 'low', joinedAt: new Date().toISOString(), boost: 0 },
    ]
  })

  test('changes user priority', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/priority/user1')
      .set(ADMIN_HEADER)
      .send({ priority: 'high' })

    expect(res.status).toBe(200)
    expect(store.queue['s1'][0].priority).toBe('high')
  })

  test('returns 400 for invalid priority', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/priority/user1')
      .set(ADMIN_HEADER)
      .send({ priority: 'urgent' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/priority/i)
  })

  test('returns 404 when user not in queue', async () => {
    const res = await request(app)
      .put('/api/admin/queues/s1/priority/nobody')
      .set(ADMIN_HEADER)
      .send({ priority: 'high' })

    expect(res.status).toBe(404)
  })
})
