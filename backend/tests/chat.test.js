const request = require('supertest')

jest.mock('../db', () => ({ query: jest.fn() }))
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn()
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  MockAnthropic.__mockCreate = mockCreate
  return MockAnthropic
})

const app = require('../server')
const db = require('../db')
const Anthropic = require('@anthropic-ai/sdk')

function getMockCreate() {
  return Anthropic.__mockCreate
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  getMockCreate().mockResolvedValue({
    content: [{ text: 'There are 3 people waiting. Estimated wait is 30 minutes.' }],
  })
})

afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY
})

function mockQueueContext() {
  db.query
    .mockResolvedValueOnce([[{ id: 1, name: 'Dine-in', description: 'Table service', expected: 10, open: 1 }]])
    .mockResolvedValueOnce([[{ queue_id: 1 }]])
    .mockResolvedValueOnce([[{ cnt: 3 }]])
    .mockResolvedValueOnce([[]])
}

describe('POST /api/chat', () => {
  test('returns AI reply for a valid message', async () => {
    mockQueueContext()

    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'How long is the wait?' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('reply')
    expect(typeof res.body.reply).toBe('string')
    expect(res.body.reply.length).toBeGreaterThan(0)
  })

  test('returns 400 when message is missing', async () => {
    const res = await request(app).post('/api/chat').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/message is required/i)
  })

  test('returns 400 when message is empty string', async () => {
    const res = await request(app).post('/api/chat').send({ message: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/message is required/i)
  })

  test('returns 400 when message exceeds 500 characters', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'a'.repeat(501) })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/too long/i)
  })

  test('returns 503 when API key is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const res = await request(app).post('/api/chat').send({ message: 'Hello' })
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/not configured/i)
  })

  test('includes conversation history in the request', async () => {
    mockQueueContext()

    const history = [
      { role: 'user', content: 'What services are available?' },
      { role: 'assistant', content: 'We have Dine-in and Takeaway.' },
    ]

    await request(app)
      .post('/api/chat')
      .send({ message: 'Which is faster?', history })

    expect(getMockCreate()).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'What services are available?' }),
          expect.objectContaining({ role: 'assistant', content: 'We have Dine-in and Takeaway.' }),
          expect.objectContaining({ role: 'user', content: 'Which is faster?' }),
        ]),
      })
    )
  })

  test('returns 500 when Claude API throws', async () => {
    mockQueueContext()
    getMockCreate().mockRejectedValueOnce(new Error('API down'))

    const res = await request(app).post('/api/chat').send({ message: 'Hello' })
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/unavailable/i)
  })
})
