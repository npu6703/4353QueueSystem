const express = require('express');
const db = require('../db');
const { notifyAdmins } = require('../utils/notify');

const router = express.Router();

// POST /api/queue/join
router.post('/api/queue/join', async (req, res) => {
  try {
    const { serviceId, userId, userName: bodyUserName, priority } = req.body;

    if (!serviceId || !userId) {
      return res.status(400).json({ error: 'serviceId and userId are required' });
    }

    // Check service exists and is open
    const [services] = await db.query(
      'SELECT service_id, name, expected_duration, priority, is_open FROM Service WHERE service_id = ?',
      [serviceId]
    );
    if (services.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const svc = services[0];
    if (!svc.is_open) {
      return res.status(400).json({ error: 'This service is currently closed' });
    }

    // Check user exists and get their name
    const [users] = await db.query(
      `SELECT uc.user_id, up.full_name
       FROM UserCredentials uc
       LEFT JOIN UserProfile up ON uc.user_id = up.user_id
       WHERE uc.user_id = ?`,
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find queue for this service
    const [queues] = await db.query(
      'SELECT queue_id FROM Queue WHERE service_id = ?',
      [serviceId]
    );
    if (queues.length === 0) {
      return res.status(404).json({ error: 'Queue not found for this service' });
    }
    const queueId = queues[0].queue_id;

    // Check for duplicate active entry
    const [existing] = await db.query(
      "SELECT entry_id FROM QueueEntry WHERE queue_id = ? AND user_id = ? AND status = 'waiting'",
      [queueId, userId]
    );
    if (existing.length > 0) {
      return res.status(200).json({ success: true, message: 'User already in queue' });
    }

    // Calculate position as MAX(position) + 1
    const [[{ maxPos }]] = await db.query(
      "SELECT IFNULL(MAX(position), 0) AS maxPos FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'",
      [queueId]
    );
    const position = maxPos + 1;

    const userName = bodyUserName || users[0].full_name || String(userId);
    const entryPriority = priority || svc.priority || 'low';

    await db.query(
      `INSERT INTO QueueEntry (queue_id, user_id, user_name, position, priority, status)
       VALUES (?, ?, ?, ?, ?, 'waiting')`,
      [queueId, userId, userName, position, entryPriority]
    );

    // Add notification (non-blocking — failure should not break join)
    try {
      await db.query(
        "INSERT INTO Notification (user_id, message, status) VALUES (?, ?, 'sent')",
        [userId, `You joined ${svc.name} queue (${entryPriority} priority)`]
      );
    } catch (notifErr) {
      console.error('Failed to insert join notification:', notifErr);
    }

    await notifyAdmins(`${userName} joined ${svc.name} queue (${entryPriority} priority)`);

    return res.status(201).json({
      success: true,
      entry: {
        userId,
        userName,
        priority: entryPriority,
        joinedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to join queue' });
  }
});

// DELETE /api/queue/leave
router.delete('/api/queue/leave', async (req, res) => {
  try {
    const serviceId = req.body?.serviceId || req.query?.serviceId;
    const userId = req.body?.userId || req.query?.userId;

    if (!serviceId || !userId) {
      return res.status(400).json({ error: 'serviceId and userId are required' });
    }

    // Find queue for this service
    const [queues] = await db.query(
      'SELECT queue_id FROM Queue WHERE service_id = ?',
      [serviceId]
    );
    if (queues.length === 0) {
      return res.status(200).json({ success: true });
    }
    const queueId = queues[0].queue_id;

    // Find the user's active entry
    const [entries] = await db.query(
      "SELECT entry_id, position, user_name FROM QueueEntry WHERE queue_id = ? AND user_id = ? AND status = 'waiting'",
      [queueId, userId]
    );
    if (entries.length === 0) {
      return res.status(200).json({ success: true });
    }

    const removedPosition = entries[0].position;

    // Mark entry as cancelled
    await db.query(
      "UPDATE QueueEntry SET status = 'cancelled' WHERE entry_id = ?",
      [entries[0].entry_id]
    );

    // Reorder positions: decrement all positions after the removed one
    await db.query(
      "UPDATE QueueEntry SET position = position - 1 WHERE queue_id = ? AND status = 'waiting' AND position > ?",
      [queueId, removedPosition]
    );

    // Get service name for notification
    const [services] = await db.query(
      'SELECT name FROM Service WHERE service_id = ?',
      [serviceId]
    );
    const serviceName = services.length > 0 ? services[0].name : serviceId;

    try {
      await db.query(
        "INSERT INTO Notification (user_id, message, status) VALUES (?, ?, 'sent')",
        [userId, `You left ${serviceName} queue`]
      );
    } catch (notifErr) {
      console.error('Failed to insert leave notification:', notifErr);
    }

    const leaverName = entries[0].user_name || `User ${userId}`;
    await notifyAdmins(`${leaverName} left ${serviceName} queue`);

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to leave queue' });
  }
});


const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 };
const AGING_FACTOR = 1;

function calcScore(priority, joinTime) {
  const waitedMinutes = (Date.now() - new Date(joinTime).getTime()) / 60000;
  return (PRIORITY_WEIGHTS[priority] || 0) + waitedMinutes * AGING_FACTOR;
}

// GET /api/queue/status?userId=...
router.get('/api/queue/status', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Find the user's active queue entry with service info
    const [entries] = await db.query(
      `SELECT qe.entry_id, qe.priority, qe.join_time,
              qe.queue_id, s.service_id, s.name AS serviceName, s.expected_duration
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status = 'waiting'
       LIMIT 1`,
      [userId]
    );

    if (entries.length === 0) {
      return res.status(200).json(null);
    }

    const entry = entries[0];

    // Fetch every waiting entry in the same queue so we can compute position
    // dynamically — the admin reorder/priority changes only affect join_time
    // and priority, so reading the stored position column would give stale results.
    const [allWaiting] = await db.query(
      `SELECT entry_id, priority, join_time
       FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'`,
      [entry.queue_id]
    );

    // Sort by the same algorithm used in adminQueue.js
    const sorted = [...allWaiting].sort((a, b) => {
      const diff = calcScore(b.priority, b.join_time) - calcScore(a.priority, a.join_time);
      return diff !== 0 ? diff : new Date(a.join_time) - new Date(b.join_time);
    });

    // Use Number() cast to guard against any int/string type mismatch from the DB driver
    const position = sorted.findIndex(e => Number(e.entry_id) === Number(entry.entry_id)) + 1;
    const total = allWaiting.length;
    const duration = entry.expected_duration || 10;

    // Estimate uses people-ahead × per-person duration so the user side matches
    // exactly what the admin queue table shows for the same entry. The estimate
    // shrinks naturally as people are served (position drops) without depending
    // on join_time, which admin reorder actions can shift.
    const expectedWait = (position - 1) * duration;

    return res.status(200).json({
      serviceId: entry.service_id,
      serviceName: entry.serviceName,
      position,
      total,
      priority: entry.priority,
      joinedAt: entry.join_time,
      expectedWait,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// GET /api/history?userId=...
router.get('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const [rows] = await db.query(
      `SELECT qe.entry_id AS id, qe.user_id AS userId, qe.user_name AS userName,
              s.service_id AS serviceId, s.name AS serviceName,
              qe.priority, qe.join_time AS joinedAt, qe.status AS outcome
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status IN ('served', 'cancelled')
       ORDER BY qe.join_time DESC`,
      [userId]
    );

    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
