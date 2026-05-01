const db = require('../db')
const { checkAdmin } = require('../middleware/roleMiddleware')

jest.mock('../db', () => ({ query: jest.fn() }))

function makeReqRes(headers = {}) {
  const req = { headers }
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  const next = jest.fn()
  return { req, res, next }
}

beforeEach(() => jest.clearAllMocks())

describe('checkAdmin — header validation', () => {
  test('returns 401 when user-id header is missing', async () => {
    const { req, res, next } = makeReqRes({})
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/missing/i) })
    )
    expect(next).not.toHaveBeenCalled()
  })

  test('returns 401 when user-id is a non-numeric string', async () => {
    const { req, res, next } = makeReqRes({ 'user-id': 'abc' })
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('returns 401 when user-id is a float (not an integer)', async () => {
    const { req, res, next } = makeReqRes({ 'user-id': '1.5' })
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('returns 401 when user-id is zero', async () => {
    const { req, res, next } = makeReqRes({ 'user-id': '0' })
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('returns 401 when user-id is negative', async () => {
    const { req, res, next } = makeReqRes({ 'user-id': '-5' })
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('checkAdmin — database checks', () => {
  test('returns 403 when user does not exist in DB', async () => {
    db.query.mockResolvedValueOnce([[]])
    const { req, res, next } = makeReqRes({ 'user-id': '99' })
    await checkAdmin(req, res, next)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT role'),
      [99]
    )
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/admin/i) })
    )
    expect(next).not.toHaveBeenCalled()
  })

  test('returns 403 when user exists but has a non-admin role', async () => {
    db.query.mockResolvedValueOnce([[{ role: 'user' }]])
    const { req, res, next } = makeReqRes({ 'user-id': '2' })
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  test('calls next() and sets req.user when user is a valid admin', async () => {
    db.query.mockResolvedValueOnce([[{ role: 'admin' }]])
    const { req, res, next } = makeReqRes({ 'user-id': '3' })
    await checkAdmin(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.user).toEqual({ id: 3, role: 'admin' })
    expect(res.status).not.toHaveBeenCalled()
  })

  test('returns 500 when the DB query throws', async () => {
    db.query.mockRejectedValueOnce(new Error('Connection reset'))
    const { req, res, next } = makeReqRes({ 'user-id': '1' })
    await checkAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/auth check failed/i) })
    )
    expect(next).not.toHaveBeenCalled()
  })
})
