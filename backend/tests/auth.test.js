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

    test('should return 400 for invalid role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Quynh Vu',
          email: 'quynh@test.com',
          password: 'password123',
          role: 'manager',
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.message).toBe('Role must be user or admin')
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
})