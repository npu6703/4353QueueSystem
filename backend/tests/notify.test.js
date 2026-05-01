const db = require('../db')
const { notifyAdmins } = require('../utils/notify')

jest.mock('../db', () => ({ query: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

describe('notifyAdmins', () => {
  test('inserts a notification row for every admin user', async () => {
    db.query
      .mockResolvedValueOnce([[{ user_id: 1 }, { user_id: 2 }]])  // SELECT admins
      .mockResolvedValueOnce([{ affectedRows: 1 }])                 // INSERT for admin 1
      .mockResolvedValueOnce([{ affectedRows: 1 }])                 // INSERT for admin 2

    await notifyAdmins('System maintenance at midnight')

    const insertCalls = db.query.mock.calls.filter(([sql]) =>
      /INSERT INTO Notification/.test(sql)
    )
    expect(insertCalls).toHaveLength(2)
    expect(insertCalls[0][1]).toEqual([1, 'System maintenance at midnight'])
    expect(insertCalls[1][1]).toEqual([2, 'System maintenance at midnight'])
  })

  test('returns early and skips INSERTs when no admin users exist', async () => {
    db.query.mockResolvedValueOnce([[]])  // SELECT returns empty

    await notifyAdmins('No admins here')

    expect(db.query).toHaveBeenCalledTimes(1)  // only the SELECT
    const insertCalls = db.query.mock.calls.filter(([sql]) => /INSERT/.test(sql))
    expect(insertCalls).toHaveLength(0)
  })

  test('continues to remaining admins when one INSERT fails', async () => {
    db.query
      .mockResolvedValueOnce([[{ user_id: 10 }, { user_id: 11 }]])  // SELECT admins
      .mockRejectedValueOnce(new Error('Disk full'))                  // INSERT for admin 10 fails
      .mockResolvedValueOnce([{ affectedRows: 1 }])                   // INSERT for admin 11 succeeds

    // Must not throw despite the inner failure
    await expect(notifyAdmins('partial failure test')).resolves.toBeUndefined()

    const insertCalls = db.query.mock.calls.filter(([sql]) =>
      /INSERT INTO Notification/.test(sql)
    )
    // Both INSERTs were attempted even though the first one threw
    expect(insertCalls).toHaveLength(2)
    expect(insertCalls[1][1]).toEqual([11, 'partial failure test'])
  })

  test('does not throw when the admin SELECT query itself fails', async () => {
    db.query.mockRejectedValueOnce(new Error('DB unreachable'))

    await expect(notifyAdmins('silent failure test')).resolves.toBeUndefined()
    expect(db.query).toHaveBeenCalledTimes(1)
  })
})
