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
const ADMIN = { role: 'admin' }

beforeEach(() => jest.clearAllMocks())

// ===== GET /api/admin/reports/users =====

describe('GET /api/admin/reports/users', () => {
  test('returns JSON with aggregated user rows', async () => {
    db.query.mockResolvedValueOnce([[
      { user_id: 1, full_name: 'Alice', email: 'a@test.com', role: 'user', total_entries: 5, served: 3, cancelled: 1, waiting: 1, last_activity: '2026-04-28T10:00:00.000Z' },
      { user_id: 2, full_name: 'Bob', email: 'b@test.com', role: 'admin', total_entries: 0, served: 0, cancelled: 0, waiting: 0, last_activity: null },
    ]])

    const res = await request(app).get('/api/admin/reports/users').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
    expect(res.body.data[0]).toMatchObject({
      userId: 1, fullName: 'Alice', email: 'a@test.com', role: 'user',
      totalEntries: 5, served: 3, cancelled: 1, waiting: 1,
    })
  })

  test('CSV format returns text/csv with proper headers', async () => {
    db.query.mockResolvedValueOnce([[
      { user_id: 1, full_name: 'Alice "Quoted"', email: 'a@test.com', role: 'user', total_entries: 1, served: 1, cancelled: 0, waiting: 0, last_activity: null },
    ]])

    const res = await request(app).get('/api/admin/reports/users?format=csv').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="users-report-/)
    expect(res.text).toContain('User ID,Full Name')
    // Quote-escape test
    expect(res.text).toContain('"Alice ""Quoted"""')
  })

  test('passes date filters to SQL params', async () => {
    db.query.mockResolvedValueOnce([[]])

    await request(app)
      .get('/api/admin/reports/users?from=2026-04-01&to=2026-04-30')
      .set(ADMIN)

    const sqlCall = db.query.mock.calls[0]
    expect(sqlCall[0]).toMatch(/qe\.join_time >= \?/)
    expect(sqlCall[0]).toMatch(/qe\.join_time <= \?/)
    expect(sqlCall[1]).toEqual(['2026-04-01 00:00:00', '2026-04-30 23:59:59'])
  })

  test('ignores malformed date filters', async () => {
    db.query.mockResolvedValueOnce([[]])

    await request(app).get('/api/admin/reports/users?from=not-a-date&to=2026-04-30').set(ADMIN)

    const sqlCall = db.query.mock.calls[0]
    // Only the "to" filter should be applied
    expect(sqlCall[1]).toEqual(['2026-04-30 23:59:59'])
  })

  test('with date filters active, applies HAVING total_entries > 0', async () => {
    db.query.mockResolvedValueOnce([[]])

    await request(app).get('/api/admin/reports/users?from=2026-04-27&to=2026-04-28').set(ADMIN)

    const sqlCall = db.query.mock.calls[0]
    expect(sqlCall[0]).toMatch(/HAVING total_entries > 0/)
  })

  test('without date filters, no HAVING clause (all users included)', async () => {
    db.query.mockResolvedValueOnce([[]])

    await request(app).get('/api/admin/reports/users').set(ADMIN)

    const sqlCall = db.query.mock.calls[0]
    expect(sqlCall[0]).not.toMatch(/HAVING/)
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/reports/users')
    expect(res.status).toBe(403)
  })

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))
    const res = await request(app).get('/api/admin/reports/users').set(ADMIN)
    expect(res.status).toBe(500)
  })
})

// ===== GET /api/admin/reports/services =====

describe('GET /api/admin/reports/services', () => {
  test('returns aggregated service rows', async () => {
    db.query.mockResolvedValueOnce([[
      { service_id: 1, name: 'Dine-in', description: 'Tables', expected_duration: 30, priority: 'medium', is_open: 1, total_entries: 8, served: 5, cancelled: 2, waiting: 1, walk_ins: 1 },
    ]])

    const res = await request(app).get('/api/admin/reports/services').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.body.data[0]).toMatchObject({
      serviceId: 1, name: 'Dine-in', expectedDuration: 30, priority: 'medium', isOpen: true,
      totalEntries: 8, served: 5, cancelled: 2, waiting: 1, walkIns: 1,
    })
  })

  test('CSV format works', async () => {
    db.query.mockResolvedValueOnce([[
      { service_id: 1, name: 'Dine-in', description: 'Tables', expected_duration: 30, priority: 'medium', is_open: 1, total_entries: 0, served: 0, cancelled: 0, waiting: 0, walk_ins: 0 },
    ]])

    const res = await request(app).get('/api/admin/reports/services?format=csv').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toContain('Service ID,Name')
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/reports/services')
    expect(res.status).toBe(403)
  })
})

// ===== GET /api/admin/reports/queue-stats =====

describe('GET /api/admin/reports/queue-stats', () => {
  // Helper: mock the four-query split (status counts, priority groupby,
  // avg wait so far, avg wait until served).
  function mockStats({ counts, priorityRows, avgWait, avgServed, servedWithData }) {
    db.query
      .mockResolvedValueOnce([[counts]])
      .mockResolvedValueOnce([priorityRows || []])
      .mockResolvedValueOnce([[{ avg_wait_so_far: avgWait }]])
      .mockResolvedValueOnce([[{ avg_wait_until_served: avgServed, served_with_data: servedWithData || 0 }]])
  }

  test('returns aggregate stats with derived rates and avg-wait-until-served', async () => {
    mockStats({
      counts: {
        total_entries: 10, served: 6, cancelled: 2, waiting: 2, walk_ins: 1,
      },
      priorityRows: [
        { pri: 'high', cnt: 3 },
        { pri: 'medium', cnt: 5 },
        { pri: 'low', cnt: 2 },
      ],
      avgWait: 12.34,
      avgServed: 8.72,
      servedWithData: 5,
    })

    const res = await request(app).get('/api/admin/reports/queue-stats').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.body.stats).toMatchObject({
      totalEntries: 10, served: 6, cancelled: 2, waiting: 2,
      avgWaitSoFar: 12.3,
      avgWaitUntilServed: 8.7,
      servedWithData: 5,
      serveRate: 60, cancelRate: 20,
      highPriority: 3, mediumPriority: 5, lowPriority: 2, walkIns: 1,
    })
  })

  test('handles empty result (zero division safety)', async () => {
    mockStats({
      counts: { total_entries: 0, served: 0, cancelled: 0, waiting: 0, walk_ins: 0 },
      priorityRows: [],
      avgWait: null,
      avgServed: null,
      servedWithData: 0,
    })

    const res = await request(app).get('/api/admin/reports/queue-stats').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.body.stats.serveRate).toBe(0)
    expect(res.body.stats.cancelRate).toBe(0)
    expect(res.body.stats.avgWaitSoFar).toBe(0)
    expect(res.body.stats.avgWaitUntilServed).toBe(0)
    expect(res.body.stats.servedWithData).toBe(0)
    expect(res.body.stats.highPriority).toBe(0)
  })

  test('rejects non-positive serviceId', async () => {
    const res = await request(app).get('/api/admin/reports/queue-stats?serviceId=abc').set(ADMIN)
    expect(res.status).toBe(400)
  })

  test('passes serviceId filter to SQL', async () => {
    mockStats({
      counts: { total_entries: 0, served: 0, cancelled: 0, waiting: 0, walk_ins: 0 },
      priorityRows: [],
      avgWait: null,
      avgServed: null,
      servedWithData: 0,
    })

    await request(app).get('/api/admin/reports/queue-stats?serviceId=2').set(ADMIN)

    const countsCall = db.query.mock.calls[0]
    expect(countsCall[0]).toMatch(/q\.service_id = \?/)
    expect(countsCall[1]).toEqual([2])
  })

  test('avg-wait-until-served query filters by served_at IS NOT NULL', async () => {
    mockStats({
      counts: { total_entries: 0, served: 0, cancelled: 0, waiting: 0, walk_ins: 0 },
      priorityRows: [],
      avgWait: null,
      avgServed: null,
      servedWithData: 0,
    })

    await request(app).get('/api/admin/reports/queue-stats').set(ADMIN)

    // 4th call (0-indexed = 3) is the avg-wait-until-served query
    const servedCall = db.query.mock.calls[3]
    expect(servedCall[0]).toMatch(/qe\.served_at IS NOT NULL/)
    expect(servedCall[0]).toMatch(/AVG\(TIMESTAMPDIFF\(SECOND, qe\.join_time, qe\.served_at\)\) \/ 60\.0/)
  })

  test('CSV format returns single-row CSV with new columns', async () => {
    mockStats({
      counts: { total_entries: 1, served: 1, cancelled: 0, waiting: 0, walk_ins: 0 },
      priorityRows: [{ pri: 'medium', cnt: 1 }],
      avgWait: 5,
      avgServed: 12,
      servedWithData: 1,
    })

    const res = await request(app).get('/api/admin/reports/queue-stats?format=csv').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toContain('Avg Wait Until Served')
    expect(res.text.split('\n').filter(Boolean).length).toBe(2) // header + 1 row
  })
})

// ===== GET /api/admin/reports/user-history =====

describe('GET /api/admin/reports/user-history', () => {
  test('returns history rows', async () => {
    db.query.mockResolvedValueOnce([[
      { entry_id: 1, user_id: 5, user_name: 'Alice', service_id: 1, service_name: 'Dine-in', priority: 'high', status: 'served', walk_in: 0, join_time: '2026-04-28T10:00:00.000Z', position: 1 },
    ]])

    const res = await request(app).get('/api/admin/reports/user-history').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    expect(res.body.data[0]).toMatchObject({
      entryId: 1, userId: 5, userName: 'Alice', serviceName: 'Dine-in',
      priority: 'high', status: 'served', walkIn: false,
    })
  })

  test('filters by userId', async () => {
    db.query.mockResolvedValueOnce([[]])

    await request(app).get('/api/admin/reports/user-history?userId=5').set(ADMIN)

    const sqlCall = db.query.mock.calls[0]
    expect(sqlCall[0]).toMatch(/qe\.user_id = \?/)
    expect(sqlCall[1]).toEqual([5])
  })

  test('rejects invalid userId', async () => {
    const res = await request(app).get('/api/admin/reports/user-history?userId=-1').set(ADMIN)
    expect(res.status).toBe(400)
  })

  test('CSV format works', async () => {
    db.query.mockResolvedValueOnce([[
      { entry_id: 1, user_id: 5, user_name: 'Alice', service_id: 1, service_name: 'Dine-in', priority: 'high', status: 'served', walk_in: 0, join_time: '2026-04-28T10:00:00.000Z', position: 1 },
    ]])

    const res = await request(app).get('/api/admin/reports/user-history?format=csv').set(ADMIN)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toContain('Entry ID,User ID')
  })

  test('returns 403 without admin header', async () => {
    const res = await request(app).get('/api/admin/reports/user-history')
    expect(res.status).toBe(403)
  })
})
