const request = require('supertest')
const express = require('express')

jest.mock('../db', () => ({
  execute: jest.fn(),
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

const pool = require('../db')
const bcrypt = require('bcrypt')
const authRoutes = require('../routes/auth')

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/auth/register', () => {
    test('should register user successfully', async () => {
      pool.execute
        .mockResolvedValueOnce([[]]) // email not exists
        .mockResolvedValueOnce([{ insertId: 1 }]) // insert credentials
        .mockResolvedValueOnce([{}]) // insert profile

      bcrypt.hash.mockResolvedValue('hashed-password')

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Quynh Vu',
          email: 'quynh@test.com',
          password: 'password123',
          role: 'user',
          phone: '8325551234',
        })

      expect(res.statusCode).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.email).toBe('quynh@test.com')
      expect(res.body.data.role).toBe('user')
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
    })

    test('should return 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'quynh@test.com',
          password: 'password123',
          role: 'user',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toBe('All fields are required')
    })

    test('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Quynh Vu',
          email: 'bad-email',
          password: 'password123',
          role: 'user',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Invalid email format')
    })

    test('ignores role in body and always registers as user (no privilege escalation)', async () => {
      pool.execute
        .mockResolvedValueOnce([[]]) // email not exists
        .mockResolvedValueOnce([{ insertId: 7 }]) // insert credentials
        .mockResolvedValueOnce([{}]) // insert profile

      bcrypt.hash.mockResolvedValue('hashed-password')

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sneaky User',
          email: 'sneaky@test.com',
          password: 'password123',
          role: 'admin',
        })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.role).toBe('user')
      // Verify the credential insert used 'user', not 'admin'
      const credentialCall = pool.execute.mock.calls[1]
      expect(credentialCall[1]).toContain('user')
      expect(credentialCall[1]).not.toContain('admin')
    })

    test('should return 409 if email already exists', async () => {
      pool.execute.mockResolvedValueOnce([[{ user_id: 1 }]])

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Quynh Vu',
          email: 'quynh@test.com',
          password: 'password123',
          role: 'user',
        })

      expect(res.statusCode).toBe(409)
      expect(res.body.message).toBe('Email already exists')
    })
  })

  describe('POST /api/auth/login', () => {
    test('should login successfully', async () => {
      pool.execute.mockResolvedValueOnce([[
        {
          user_id: 1,
          email: 'quynh@test.com',
          password: 'hashed-password',
          role: 'user',
          full_name: 'Quynh Vu',
          phone: '8325551234',
        },
      ]])

      bcrypt.compare.mockResolvedValue(true)

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'quynh@test.com',
          password: 'password123',
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.email).toBe('quynh@test.com')
      expect(res.body.data.isAdmin).toBe(false)
    })

    test('should return 400 when email or password missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'quynh@test.com',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Email and password are required')
    })

    test('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bad-email',
          password: 'password123',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Invalid email format')
    })

    test('should return 401 when user does not exist', async () => {
      pool.execute.mockResolvedValueOnce([[]])

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'missing@test.com',
          password: 'password123',
        })

      expect(res.statusCode).toBe(401)
      expect(res.body.message).toBe('Invalid email or password')
    })

    test('should return 401 when password is incorrect', async () => {
      pool.execute.mockResolvedValueOnce([[
        {
          user_id: 1,
          email: 'quynh@test.com',
          password: 'hashed-password',
          role: 'user',
          full_name: 'Quynh Vu',
          phone: '',
        },
      ]])

      bcrypt.compare.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'quynh@test.com',
          password: 'wrongpass',
        })

      expect(res.statusCode).toBe(401)
      expect(res.body.message).toBe('Invalid email or password')
    })
  })

  // -------------------------------------------------------------------------
  // Additional coverage for uncovered validation branches and error paths
  // -------------------------------------------------------------------------

  describe('POST /api/auth/register — input validation edge cases', () => {
    test('returns 400 when a field is a non-string type (line 24)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 123, email: 'a@b.com', password: 'pass1' })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Invalid input types')
    })

    test('returns 400 when phone is provided but is not a string (line 24)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Quinn', email: 'a@b.com', password: 'pass1', phone: 8001234567 })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Invalid input types')
    })

    test('returns 400 when name is shorter than 2 characters (line 39)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'a@b.com', password: 'pass1' })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Name must be between 2 and 50 characters')
    })

    test('returns 400 when name exceeds 50 characters (line 39)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'A'.repeat(51), email: 'a@b.com', password: 'pass1' })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Name must be between 2 and 50 characters')
    })

    test('returns 400 when email exceeds 100 characters (line 46)', async () => {
      const longEmail = 'a'.repeat(95) + '@b.com'   // 101 chars
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Quinn', email: longEmail, password: 'pass1' })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Email must not exceed 100 characters')
    })

    test('returns 400 when password is shorter than 4 characters (line 60)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Quinn', email: 'a@b.com', password: 'abc' })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Password must be between 4 and 50 characters')
    })

    test('returns 400 when password exceeds 50 characters (line 60)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Quinn', email: 'a@b.com', password: 'p'.repeat(51) })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Password must be between 4 and 50 characters')
    })

    test('returns 500 when a DB query throws during registration (lines 105-106)', async () => {
      pool.execute.mockRejectedValueOnce(new Error('DB crash'))
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Quinn', email: 'a@b.com', password: 'pass1' })
      expect(res.statusCode).toBe(500)
      expect(res.body.message).toBe('Server error during registration')
    })
  })

  describe('POST /api/auth/login — input validation edge cases', () => {
    test('returns 400 when email or password is a non-string type (line 126)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 12345 })
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Invalid input types')
    })

    test('returns 500 when a DB query throws during login (lines 179-180)', async () => {
      pool.execute.mockRejectedValueOnce(new Error('DB crash'))
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'pass1' })
      expect(res.statusCode).toBe(500)
      expect(res.body.message).toBe('Server error during login')
    })
  })
})