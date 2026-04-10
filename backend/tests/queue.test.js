const request = require('supertest');
const app = require('../server');

jest.mock('../db', () => ({ query: jest.fn() }));

const db = require('../db');

beforeEach(() => jest.resetAllMocks());

// ===== POST /api/queue/join =====

describe('POST /api/queue/join', () => {
  function mockJoinSuccess({ svc, user, queueId, existing = [], maxPos = 0 } = {}) {
    db.query
      // 1. Service lookup
      .mockResolvedValueOnce([[svc || { service_id: 's1', name: 'Dine-in', expected_duration: 30, priority: 'medium', is_open: true }]])
      // 2. User lookup
      .mockResolvedValueOnce([[user || { user_id: 'user1', full_name: 'John Doe' }]])
      // 3. Queue lookup
      .mockResolvedValueOnce([[{ queue_id: queueId || 'q1' }]])
      // 4. Duplicate check
      .mockResolvedValueOnce([existing])
      // 5. MAX(position)
      .mockResolvedValueOnce([[{ maxPos }]])
      // 6. INSERT QueueEntry
      .mockResolvedValueOnce([{ insertId: 1 }])
      // 7. INSERT Notification
      .mockResolvedValueOnce([{ insertId: 1 }]);
  }

  test('joins a queue successfully', async () => {
    mockJoinSuccess();

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1', priority: 'medium' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.userId).toBe('user1');
    expect(res.body.entry.userName).toBe('John Doe');
    expect(res.body.entry.priority).toBe('medium');
    expect(res.body.entry).toHaveProperty('joinedAt');
  });

  test('returns 400 when serviceId is missing', async () => {
    const res = await request(app)
      .post('/api/queue/join')
      .send({ userId: 'user1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/serviceId and userId are required/i);
  });

  test('returns 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/serviceId and userId are required/i);
  });

  test('returns 404 when service does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's999', userId: 'user1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/service not found/i);
  });

  test('returns 400 when service is closed', async () => {
    db.query.mockResolvedValueOnce([[
      { service_id: 's3', name: 'Closed', expected_duration: 15, priority: 'low', is_open: false },
    ]]);

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's3', userId: 'user1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/closed/i);
  });

  test('returns 404 when user does not exist', async () => {
    db.query
      .mockResolvedValueOnce([[{ service_id: 's1', name: 'Dine-in', expected_duration: 30, priority: 'medium', is_open: true }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/user not found/i);
  });

  test('returns 404 when queue does not exist for service', async () => {
    db.query
      .mockResolvedValueOnce([[{ service_id: 's1', name: 'Dine-in', expected_duration: 30, priority: 'medium', is_open: true }]])
      .mockResolvedValueOnce([[{ user_id: 'user1', full_name: 'John Doe' }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/queue not found/i);
  });

  test('returns 200 if user is already in queue (no duplicate)', async () => {
    db.query
      .mockResolvedValueOnce([[{ service_id: 's1', name: 'Dine-in', expected_duration: 30, priority: 'medium', is_open: true }]])
      .mockResolvedValueOnce([[{ user_id: 'user1', full_name: 'John Doe' }]])
      .mockResolvedValueOnce([[{ queue_id: 'q1' }]])
      .mockResolvedValueOnce([[{ entry_id: 99 }]]);

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already in queue/i);
  });

  test('position is MAX(position) + 1', async () => {
    mockJoinSuccess({ maxPos: 3 });

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(201);

    // Verify the INSERT was called with position 4
    const insertCall = db.query.mock.calls[5];
    expect(insertCall[1]).toContain(4); // position = maxPos(3) + 1
  });

  test('uses service default priority when none provided', async () => {
    mockJoinSuccess({
      svc: { service_id: 's1', name: 'Dine-in', expected_duration: 30, priority: 'medium', is_open: true },
    });

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(201);
    expect(res.body.entry.priority).toBe('medium');
  });

  test('uses body userName when provided', async () => {
    mockJoinSuccess();

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1', userName: 'Custom Name' });

    expect(res.status).toBe(201);
    expect(res.body.entry.userName).toBe('Custom Name');
  });

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(500);
  });
});

// ===== DELETE /api/queue/leave =====

describe('DELETE /api/queue/leave', () => {
  function mockLeaveSuccess({ position = 2 } = {}) {
    db.query
      // 1. Queue lookup
      .mockResolvedValueOnce([[{ queue_id: 'q1' }]])
      // 2. Entry lookup
      .mockResolvedValueOnce([[{ entry_id: 10, position }]])
      // 3. UPDATE status to cancelled
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // 4. Reorder positions
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // 5. Service name lookup
      .mockResolvedValueOnce([[{ name: 'Dine-in' }]])
      // 6. INSERT Notification
      .mockResolvedValueOnce([{ insertId: 1 }]);
  }

  test('removes user from queue', async () => {
    mockLeaveSuccess();

    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('updates status to cancelled in the database', async () => {
    mockLeaveSuccess({ position: 2 });

    await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user1' });

    // Third query should be the UPDATE to cancelled
    const cancelCall = db.query.mock.calls[2];
    expect(cancelCall[0]).toMatch(/status = 'cancelled'/);
  });

  test('reorders positions after removal', async () => {
    mockLeaveSuccess({ position: 2 });

    await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user1' });

    // Fourth query should be the position reorder
    const reorderCall = db.query.mock.calls[3];
    expect(reorderCall[0]).toMatch(/position = position - 1/);
    expect(reorderCall[1]).toContain(2); // position > 2
  });

  test('returns 400 when serviceId is missing', async () => {
    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ userId: 'user1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/serviceId and userId are required/i);
  });

  test('returns 400 when userId is missing', async () => {
    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/serviceId and userId are required/i);
  });

  test('succeeds gracefully when queue does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 'nonexistent', userId: 'user1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('succeeds gracefully when user is not in queue', async () => {
    db.query
      .mockResolvedValueOnce([[{ queue_id: 'q1' }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(500);
  });
});

// ===== GET /api/queue/status =====

describe('GET /api/queue/status', () => {
  test('returns queue status for a user in queue', async () => {
    db.query
      // 1. Entry + service lookup
      .mockResolvedValueOnce([[{
        entry_id: 1,
        position: 2,
        priority: 'medium',
        join_time: new Date().toISOString(),
        queue_id: 'q1',
        service_id: 's1',
        serviceName: 'Dine-in',
        expected_duration: 30,
      }]])
      // 2. Total count
      .mockResolvedValueOnce([[{ total: 5 }]]);

    const res = await request(app).get('/api/queue/status?userId=user1');

    expect(res.status).toBe(200);
    expect(res.body.serviceId).toBe('s1');
    expect(res.body.serviceName).toBe('Dine-in');
    expect(res.body.position).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.priority).toBe('medium');
    expect(res.body).toHaveProperty('joinedAt');
    expect(res.body).toHaveProperty('expectedWait');
  });

  test('returns null when user is not in any queue', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/queue/status?userId=admin1');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/api/queue/status');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId is required/i);
  });

  test('expectedWait is 0 for the first person in queue (position 1)', async () => {
    db.query
      .mockResolvedValueOnce([[{
        entry_id: 1,
        position: 1,
        priority: 'high',
        join_time: new Date().toISOString(),
        queue_id: 'q1',
        service_id: 's1',
        serviceName: 'Dine-in',
        expected_duration: 30,
      }]])
      .mockResolvedValueOnce([[{ total: 1 }]]);

    const res = await request(app).get('/api/queue/status?userId=user1');

    expect(res.body.position).toBe(1);
    expect(res.body.expectedWait).toBe(0);
  });

  test('expectedWait equals (position-1) * expected_duration', async () => {
    db.query
      .mockResolvedValueOnce([[{
        entry_id: 2,
        position: 3,
        priority: 'low',
        join_time: new Date().toISOString(),
        queue_id: 'q1',
        service_id: 's2',
        serviceName: 'Takeaway',
        expected_duration: 10,
      }]])
      .mockResolvedValueOnce([[{ total: 5 }]]);

    const res = await request(app).get('/api/queue/status?userId=user2');

    // position 3, expected_duration 10 → (3-1)*10 = 20
    expect(res.body.expectedWait).toBe(20);
  });

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/queue/status?userId=user1');

    expect(res.status).toBe(500);
  });
});

// ===== GET /api/history =====

describe('GET /api/history', () => {
  test('returns history for the given user', async () => {
    db.query.mockResolvedValueOnce([[
      {
        id: 1,
        userId: 'user1',
        userName: 'John Doe',
        serviceId: 's1',
        serviceName: 'Dine-in',
        priority: 'medium',
        joinedAt: '2025-01-15T10:00:00.000Z',
        outcome: 'served',
      },
      {
        id: 3,
        userId: 'user1',
        userName: 'John Doe',
        serviceId: 's2',
        serviceName: 'Takeaway',
        priority: 'low',
        joinedAt: '2025-01-15T11:00:00.000Z',
        outcome: 'cancelled',
      },
    ]]);

    const res = await request(app).get('/api/history?userId=user1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((h) => h.userId === 'user1')).toBe(true);
  });

  test('returns empty array when user has no history', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/history?userId=admin1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/api/history');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId is required/i);
  });

  test('history entries include expected fields', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 1,
      userId: 'user1',
      userName: 'John Doe',
      serviceId: 's1',
      serviceName: 'Dine-in',
      priority: 'medium',
      joinedAt: '2025-01-15T10:00:00.000Z',
      outcome: 'served',
    }]]);

    const res = await request(app).get('/api/history?userId=user1');

    const entry = res.body[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('serviceId');
    expect(entry).toHaveProperty('serviceName');
    expect(entry).toHaveProperty('outcome');
    expect(entry).toHaveProperty('joinedAt');
  });

  test('includes both served and cancelled entries', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, userId: 'user1', userName: 'John', serviceId: 's1', serviceName: 'Dine-in', priority: 'medium', joinedAt: '2025-01-15T10:00:00.000Z', outcome: 'served' },
      { id: 2, userId: 'user1', userName: 'John', serviceId: 's2', serviceName: 'Takeaway', priority: 'low', joinedAt: '2025-01-15T11:00:00.000Z', outcome: 'cancelled' },
    ]]);

    const res = await request(app).get('/api/history?userId=user1');

    const outcomes = res.body.map((h) => h.outcome);
    expect(outcomes).toContain('served');
    expect(outcomes).toContain('cancelled');
  });

  test('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/history?userId=user1');

    expect(res.status).toBe(500);
  });
});

// ===== Wait-Time Estimation =====

describe('Wait-time estimation', () => {
  test('wait time is (position-1) * expected_duration', async () => {
    db.query
      .mockResolvedValueOnce([[{
        entry_id: 2,
        position: 2,
        priority: 'low',
        join_time: new Date().toISOString(),
        queue_id: 'q1',
        service_id: 's2',
        serviceName: 'Takeaway',
        expected_duration: 10,
      }]])
      .mockResolvedValueOnce([[{ total: 3 }]]);

    const res = await request(app).get('/api/queue/status?userId=user2');

    // position 2, expected_duration 10 → (2-1)*10 = 10
    expect(res.body.expectedWait).toBe(10);
  });

  test('first person in queue always has 0 wait time', async () => {
    db.query
      .mockResolvedValueOnce([[{
        entry_id: 1,
        position: 1,
        priority: 'high',
        join_time: new Date().toISOString(),
        queue_id: 'q1',
        service_id: 's1',
        serviceName: 'Dine-in',
        expected_duration: 30,
      }]])
      .mockResolvedValueOnce([[{ total: 1 }]]);

    const res = await request(app).get('/api/queue/status?userId=user1');

    expect(res.body.expectedWait).toBe(0);
  });

  test('wait time scales correctly with position and duration', async () => {
    db.query
      .mockResolvedValueOnce([[{
        entry_id: 5,
        position: 5,
        priority: 'low',
        join_time: new Date().toISOString(),
        queue_id: 'q1',
        service_id: 's1',
        serviceName: 'Dine-in',
        expected_duration: 15,
      }]])
      .mockResolvedValueOnce([[{ total: 8 }]]);

    const res = await request(app).get('/api/queue/status?userId=user5');

    // position 5, expected_duration 15 → (5-1)*15 = 60
    expect(res.body.expectedWait).toBe(60);
  });
});
