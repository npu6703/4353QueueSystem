const request = require('supertest');
const app = require('../server');

describe('Authentication API', () => {
  const uniqueEmail = `quynh_${Date.now()}@gmail.com`;

  test('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Quynh',
        email: uniqueEmail,
        password: '123456',
        role: 'user'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('User registered successfully');
    expect(res.body.data).toHaveProperty('email', uniqueEmail);
    expect(res.body.data).toHaveProperty('role', 'user');
  });

  test('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Quynh',
        email: 'missingpassword@gmail.com',
        role: 'user'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('All fields are required');
  });

  test('should return 409 when email already exists', async () => {
    const duplicateEmail = `duplicate_${Date.now()}@gmail.com`;

    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Quynh',
        email: duplicateEmail,
        password: '123456',
        role: 'user'
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Quynh',
        email: duplicateEmail,
        password: '123456',
        role: 'user'
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email already exists');
  });

  test('should login successfully with correct credentials', async () => {
    const loginEmail = `login_${Date.now()}@gmail.com`;

    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Quynh',
        email: loginEmail,
        password: '123456',
        role: 'user'
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password: '123456'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.data).toHaveProperty('email', loginEmail);
  });

  test('should return 401 for invalid password', async () => {
    const wrongPassEmail = `wrongpass_${Date.now()}@gmail.com`;

    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Quynh',
        email: wrongPassEmail,
        password: '123456',
        role: 'user'
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: wrongPassEmail,
        password: 'wrongpass'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('should fail for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: 'invalid-email',
        password: '123456',
        role: 'user'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid email format');
  });

  test('should fail for invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test',
        email: `role_${Date.now()}@gmail.com`,
        password: '123456',
        role: 'guest'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Role must be user or admin');
  });
});