const express = require('express');
const db = require('../db');
const { checkAdmin } = require('../middleware/roleMiddleware')
const router = express.Router();

router.get('/api/admin/stats', checkAdmin, async (_req, res) => {
  try {
    const [[{ totalServices }]] = await db.query('SELECT COUNT(*) AS totalServices FROM Service')
    const [[{ openCount }]] = await db.query('SELECT COUNT(*) AS openCount FROM Service WHERE is_open = TRUE')
    const [[{ closedCount }]] = await db.query('SELECT COUNT(*) AS closedCount FROM Service WHERE is_open = FALSE')
    const [[{ totalInQueue }]] = await db.query("SELECT COUNT(*) AS totalInQueue FROM QueueEntry WHERE status = 'waiting'")
    const [[{ todayServed }]] = await db.query(
      "SELECT COUNT(*) AS todayServed FROM QueueEntry WHERE status = 'served' AND DATE(join_time) = CURDATE()"
    )

    return res.status(200).json({ totalServices, openCount, closedCount, totalInQueue, todayServed })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
});

router.get('/api/notifications', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Notification ORDER BY timestamp DESC')
    return res.status(200).json(rows)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
});

router.put('/api/notifications/read', async (_req, res) => {
  try {
    await db.query("UPDATE Notification SET status = 'viewed' WHERE status = 'sent'")
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark notifications read' })
  }
});

module.exports = router;