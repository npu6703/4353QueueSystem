const express = require('express');
const db = require('../db');
const { checkAdmin } = require('../middleware/roleMiddleware')
const router = express.Router();

// Pull a single scalar count out of a SELECT COUNT(...) AS field result while
// tolerating an empty rowset. Without this guard `[[{ openCount }]]` would
// throw if the driver ever returned an empty array.
function readCount(rows, field) {
  if (!Array.isArray(rows) || rows.length === 0) return 0
  return Number(rows[0][field]) || 0
}

router.get('/api/admin/stats', checkAdmin, async (_req, res) => {
  try {
    const [totalServicesRows] = await db.query('SELECT COUNT(*) AS totalServices FROM Service')
    const [openRows] = await db.query('SELECT COUNT(*) AS openCount FROM Service WHERE is_open = TRUE')
    const [closedRows] = await db.query('SELECT COUNT(*) AS closedCount FROM Service WHERE is_open = FALSE')
    const [totalInQueueRows] = await db.query("SELECT COUNT(*) AS totalInQueue FROM QueueEntry WHERE status = 'waiting'")
    const [todayServedRows] = await db.query(
      "SELECT COUNT(*) AS todayServed FROM QueueEntry WHERE status = 'served' AND DATE(join_time) = CURDATE()"
    )

    return res.status(200).json({
      totalServices: readCount(totalServicesRows, 'totalServices'),
      openCount: readCount(openRows, 'openCount'),
      closedCount: readCount(closedRows, 'closedCount'),
      totalInQueue: readCount(totalInQueueRows, 'totalInQueue'),
      todayServed: readCount(todayServedRows, 'todayServed'),
    })
  } catch (err) {
    console.error('admin stats error:', err)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
});

// GET /api/notifications?userId=...
// Returns notifications for a specific user. Accepts userId from query param so
// both regular users and admins (who have their own user_id) see only their own
// notifications.
router.get('/api/notifications', async (req, res) => {
  try {
    const rawId = req.query.userId
    const userId = Number(rawId)
    if (!rawId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const [rows] = await db.query(
      'SELECT notification_id, user_id, message, timestamp, status FROM Notification WHERE user_id = ? ORDER BY timestamp DESC',
      [userId]
    )
    return res.status(200).json(rows)
  } catch (err) {
    console.error('fetch notifications error:', err)
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
});

// PUT /api/notifications/read — mark notifications for a user as viewed
router.put('/api/notifications/read', async (req, res) => {
  try {
    const rawId = req.body?.userId
    const userId = Number(rawId)
    if (!rawId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId is required' })
    }
    await db.query(
      "UPDATE Notification SET status = 'viewed' WHERE status = 'sent' AND user_id = ?",
      [userId]
    )
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('mark notifications read error:', err)
    return res.status(500).json({ error: 'Failed to mark notifications read' })
  }
});

module.exports = router;
