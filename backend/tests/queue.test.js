const request = require('supertest');
const app = require('../server');
const store = require('../store');

// Reset store to a clean state before each test
beforeEach(() => {
  store.users = [
    { id: 'admin1', email: 'admin@queue.com', password: 'admin123', name: 'Admin', isAdmin: true },
    { id: 'user1', email: 'user@queue.com', password: 'user123', name: 'John Doe', isAdmin: false },
    { id: 'user2', email: 'user2@queue.com', password: 'pass123', name: 'Jane Smith', isAdmin: false },
  ];
  store.services = [
    { id: 's1', name: 'Dine-in', description: 'Table service', expected: 30, priority: 'medium', open: true },
    { id: 's2', name: 'Takeaway', description: 'Quick pickup', expected: 10, priority: 'low', open: true },
    { id: 's3', name: 'Closed Service', description: 'Not available', expected: 15, priority: 'low', open: false },
  ];
  store.queue = {};
  store.history = [];
  store.notifications = [];
});

// ===== POST /api/queue/join =====

describe('POST /api/queue/join', () => {
  test('joins a queue successfully', async () => {
    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1', priority: 'medium' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.userId).toBe('user1');
    expect(res.body.entry.userName).toBe('John Doe');
    expect(res.body.entry.priority).toBe('medium');
    expect(store.queue['s1']).toHaveLength(1);
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

  test('returns 400 when service is closed', async () => {
    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's3', userId: 'user1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/closed/i);
  });

  test('does not add duplicate — returns 200 if already in queue', async () => {
    await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already in queue/i);
    expect(store.queue['s1']).toHaveLength(1);
  });

  test('fires a joined notification', async () => {
    await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0].type).toBe('joined');
  });

  test('uses service default priority when none provided', async () => {
    const res = await request(app)
      .post('/api/queue/join')
      .send({ serviceId: 's1', userId: 'user1' });

    // s1 has priority 'medium'
    expect(res.body.entry.priority).toBe('medium');
  });

  test('multiple different users can join the same queue', async () => {
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user1' });
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user2' });

    expect(store.queue['s1']).toHaveLength(2);
  });
});

// ===== DELETE /api/queue/leave =====

describe('DELETE /api/queue/leave', () => {
  beforeEach(async () => {
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user1' });
  });

  test('removes user from queue', async () => {
    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(store.queue['s1']).toHaveLength(0);
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

  test('succeeds gracefully when user is not in queue', async () => {
    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // user1 should still be in the queue
    expect(store.queue['s1']).toHaveLength(1);
  });

  test('succeeds gracefully when queue does not exist', async () => {
    const res = await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 'nonexistent', userId: 'user1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('fires a left notification', async () => {
    store.notifications = []; // clear join notification
    await request(app)
      .delete('/api/queue/leave')
      .send({ serviceId: 's1', userId: 'user1' });

    expect(store.notifications[0].type).toBe('left');
  });
});

// ===== GET /api/queue/status =====

describe('GET /api/queue/status', () => {
  beforeEach(async () => {
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user1', priority: 'low' });
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user2', priority: 'low' });
  });

  test('returns queue status for a user in queue', async () => {
    const res = await request(app).get('/api/queue/status?userId=user1');

    expect(res.status).toBe(200);
    expect(res.body.serviceId).toBe('s1');
    expect(res.body.serviceName).toBe('Dine-in');
    expect(res.body.position).toBeGreaterThanOrEqual(1);
    expect(res.body.total).toBe(2);
    expect(res.body.priority).toBe('low');
    expect(res.body).toHaveProperty('expectedWait');
    expect(res.body).toHaveProperty('score');
  });

  test('returns null when user is not in any queue', async () => {
    const res = await request(app).get('/api/queue/status?userId=admin1');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/api/queue/status');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId is required/i);
  });

  test('expectedWait is 0 for the first person in queue', async () => {
    // Put only user1 in queue with highest priority so they're #1
    store.queue = {};
    store.notifications = [];
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user1', priority: 'high' });

    const res = await request(app).get('/api/queue/status?userId=user1');
    expect(res.body.position).toBe(1);
    expect(res.body.expectedWait).toBe(0);
  });

  test('expectedWait increases with position', async () => {
    // user2 joined after user1 with same priority — should be position 2
    // Both joined with low priority at nearly the same time; user1 joined first
    const res1 = await request(app).get('/api/queue/status?userId=user1');
    const res2 = await request(app).get('/api/queue/status?userId=user2');

    // The person at position 2 should have a higher expectedWait than position 1
    expect(res2.body.expectedWait).toBeGreaterThanOrEqual(res1.body.expectedWait);
  });
});

// ===== GET /api/history =====

describe('GET /api/history', () => {
  beforeEach(() => {
    store.history = [
      {
        id: 'h1',
        userId: 'user1',
        userName: 'John Doe',
        serviceId: 's1',
        serviceName: 'Dine-in',
        priority: 'medium',
        joinedAt: new Date().toISOString(),
        servedAt: new Date().toISOString(),
        date: new Date().toISOString(),
        outcome: 'served',
      },
      {
        id: 'h2',
        userId: 'user2',
        userName: 'Jane Smith',
        serviceId: 's2',
        serviceName: 'Takeaway',
        priority: 'low',
        joinedAt: new Date().toISOString(),
        servedAt: new Date().toISOString(),
        date: new Date().toISOString(),
        outcome: 'served',
      },
      {
        id: 'h3',
        userId: 'user1',
        userName: 'John Doe',
        serviceId: 's2',
        serviceName: 'Takeaway',
        priority: 'low',
        joinedAt: new Date().toISOString(),
        servedAt: new Date().toISOString(),
        date: new Date().toISOString(),
        outcome: 'left',
      },
    ];
  });

  test('returns only history for the given user', async () => {
    const res = await request(app).get('/api/history?userId=user1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((h) => h.userId === 'user1')).toBe(true);
  });

  test('returns empty array when user has no history', async () => {
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
    const res = await request(app).get('/api/history?userId=user1');

    const entry = res.body[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('serviceId');
    expect(entry).toHaveProperty('serviceName');
    expect(entry).toHaveProperty('outcome');
    expect(entry).toHaveProperty('date');
  });
});

// ===== Wait-Time Estimation =====

describe('Wait-time estimation', () => {
  test('wait time is position-1 multiplied by service expected duration', async () => {
    // Join two users: user1 first, user2 second (same priority = arrival order)
    await request(app).post('/api/queue/join').send({ serviceId: 's2', userId: 'user1', priority: 'low' });
    await request(app).post('/api/queue/join').send({ serviceId: 's2', userId: 'user2', priority: 'low' });

    const res = await request(app).get('/api/queue/status?userId=user2');
    // s2 expected = 10 min, user2 is at position 2 → wait = 1 * 10 = 10
    expect(res.body.expectedWait).toBe(10);
  });

  test('first person in queue always has 0 wait time', async () => {
    await request(app).post('/api/queue/join').send({ serviceId: 's1', userId: 'user1', priority: 'high' });

    const res = await request(app).get('/api/queue/status?userId=user1');
    expect(res.body.expectedWait).toBe(0);
  });
});
