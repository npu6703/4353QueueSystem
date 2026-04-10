const express = require('express')
const db = require('../db')
const { checkAdmin } = require('../middleware/roleMiddleware')

const router = express.Router()

const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 }
const AGING_FACTOR = 1

function calcEffectiveScore(entry) {
  const waited = (Date.now() - new Date(entry.joinedAt).getTime()) / 60000
  return PRIORITY_WEIGHTS[entry.priority] + waited * AGING_FACTOR
}

function sortQueue(entries) {
  return [...entries].sort((a, b) => {
    const diff = calcEffectiveScore(b) - calcEffectiveScore(a)
    return diff !== 0 ? diff : new Date(a.joinedAt) - new Date(b.joinedAt)
  })
}

function enrichQueue(sorted, svc) {
  return sorted.map((entry, idx) => ({
    ...entry,
    position: idx + 1,
    score: parseFloat(calcEffectiveScore(entry).toFixed(1)),
    waitedMinutes: parseFloat(((Date.now() - new Date(entry.joinedAt).getTime()) / 60000).toFixed(1)),
    expectedWait: idx * (svc.expected || 10),
  }))
}

async function getQueueForService(serviceId) {
  const [queues] = await db.query('SELECT * FROM Queue WHERE service_id = ?', [serviceId])
  if (queues.length === 0) return null
  const queue = queues[0]
  const [entries] = await db.query(
    `SELECT entry_id AS userId, user_name AS userName, priority, 
            walk_in AS walkIn, phone, notes, status, queue_id,
            DATE_FORMAT(join_time, '%Y-%m-%dT%H:%i:%s.000Z') AS joinedAt
     FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'`,
    [queue.queue_id]
  )
  return { queue, entries }
}

async function addNotif(userId, message) {
  try {
    if (userId && !String(userId).startsWith('walkin_')) {
      await db.query(
        'INSERT INTO Notification (user_id, message, status) VALUES (?, ?, ?)',
        [userId, message, 'sent']
      )
    }
  } catch (err) {
    // notification failure shouldn't break the main action
  }
}

// GET /api/admin/queues — summary of all service queues
router.get('/api/admin/queues', checkAdmin, async (_req, res) => {
  try {
    const [services] = await db.query(
      'SELECT service_id AS id, name, description, expected_duration AS expected, priority, is_open AS `open` FROM Service'
    )

    const summary = await Promise.all(services.map(async (svc) => {
      const result = await getQueueForService(svc.id)
      const entries = result ? result.entries : []
      const sorted = sortQueue(entries)
      return {
        serviceId: svc.id,
        serviceName: svc.name,
        description: svc.description,
        open: svc.open,
        priority: svc.priority,
        expected: svc.expected,
        count: sorted.length,
        next: sorted[0] || null,
        expectedWait: sorted.length * (svc.expected || 10),
      }
    }))

    return res.status(200).json(summary)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch queues' })
  }
})

// GET /api/admin/queues/:serviceId — sorted queue for one service
router.get('/api/admin/queues/:serviceId', checkAdmin, async (req, res) => {
  try {
    const [svcs] = await db.query(
      'SELECT service_id AS id, name, description, expected_duration AS expected, priority, is_open AS `open` FROM Service WHERE service_id = ?',
      [req.params.serviceId]
    )
    if (svcs.length === 0) return res.status(404).json({ error: 'Service not found' })

    const svc = svcs[0]
    const result = await getQueueForService(svc.id)
    const entries = result ? result.entries : []
    const sorted = sortQueue(entries)

    return res.status(200).json({ service: svc, queue: enrichQueue(sorted, svc) })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch queue' })
  }
})

// GET /api/admin/history — full history
router.get('/api/admin/history', checkAdmin, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT qe.entry_id, qe.user_id, qe.user_name, qe.priority, qe.join_time, qe.status,
              s.name AS service_name, s.service_id
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.status = 'served'
       ORDER BY qe.join_time DESC`
    )
    return res.status(200).json(rows)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch history' })
  }
})

// POST /api/admin/queues/:serviceId/serve — serve next user
router.post('/api/admin/queues/:serviceId/serve', checkAdmin, async (req, res) => {
  try {
    const { serviceId } = req.params
    const [svcs] = await db.query('SELECT * FROM Service WHERE service_id = ?', [serviceId])
    if (svcs.length === 0) return res.status(404).json({ error: 'Service not found' })

    const result = await getQueueForService(serviceId)
    if (!result) return res.status(404).json({ error: 'Queue not found' })

    const sorted = sortQueue(result.entries)
    if (sorted.length === 0) return res.status(400).json({ error: 'Queue is empty' })

    const next = sorted[0]
    await db.query("UPDATE QueueEntry SET status = 'served' WHERE entry_id = ?", [next.entry_id])

    // Update positions for remaining entries
    const remaining = sorted.slice(1)
    for (let i = 0; i < remaining.length; i++) {
      await db.query('UPDATE QueueEntry SET position = ? WHERE entry_id = ?', [i + 1, remaining[i].entry_id])
    }

    // Notify next 2 people in line
    remaining.slice(0, 2).forEach(async (entry, i) => {
      await addNotif(entry.user_id, `You are ${i === 0 ? 'next' : 'almost next'} in ${svcs[0].name}!`)
    })

    return res.status(200).json({ served: next })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to serve next user' })
  }
})

// POST /api/admin/queues/:serviceId/walkin — add walk-in user
router.post('/api/admin/queues/:serviceId/walkin', checkAdmin, async (req, res) => {
  try {
    const { serviceId } = req.params
    const { name, priority, phone, notes } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' })
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' })
    }

    const [svcs] = await db.query('SELECT * FROM Service WHERE service_id = ?', [serviceId])
    if (svcs.length === 0) return res.status(404).json({ error: 'Service not found' })

    const result = await getQueueForService(serviceId)
    if (!result) return res.status(404).json({ error: 'Queue not found' })

    const entryPriority = ['low', 'medium', 'high'].includes(priority) ? priority : svcs[0].priority || 'low'
    const position = result.entries.length + 1

    const [inserted] = await db.query(
      'INSERT INTO QueueEntry (queue_id, user_id, user_name, position, priority, walk_in, phone, notes, status) VALUES (?, NULL, ?, ?, ?, TRUE, ?, ?,"waiting")',
      [result.queue.queue_id, name.trim(), position, entryPriority, phone || '', notes || '']
    )

    await addNotif(null, `Walk-in "${name.trim()}" added to ${svcs[0].name}`)

    return res.status(201).json({
      entry_id: inserted.insertId,
      user_name: name.trim(),
      priority: entryPriority,
      join_time: new Date().toISOString(),
      walk_in: true,
      phone: phone || '',
      notes: notes || '',
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add walk-in' })
  }
})

// DELETE /api/admin/queues/:serviceId/remove/:userId — remove user from queue
router.delete('/api/admin/queues/:serviceId/remove/:userId', checkAdmin, async (req, res) => {
  try {
    const { serviceId, userId } = req.params
    const [svcs] = await db.query('SELECT * FROM Service WHERE service_id = ?', [serviceId])
    if (svcs.length === 0) return res.status(404).json({ error: 'Service not found' })

    const result = await getQueueForService(serviceId)
    if (!result) return res.status(404).json({ error: 'Queue not found' })

    await db.query(
      "UPDATE QueueEntry SET status = 'cancelled' WHERE queue_id = ? AND entry_id = ?",
      [result.queue.queue_id, userId]
    )

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove user' })
  }
})

// PUT /api/admin/queues/:serviceId/boost/:userId — move user up or down
router.put('/api/admin/queues/:serviceId/boost/:userId', checkAdmin, async (req, res) => {
  try {
    const { serviceId, userId } = req.params
    const { amount } = req.body

    const result = await getQueueForService(serviceId)
    if (!result) return res.status(404).json({ error: 'Queue not found' })

    const sorted = sortQueue(result.entries)
    const idx = sorted.findIndex((e) => e.entry_id == userId)
    if (idx < 0) return res.status(404).json({ error: 'User not found in queue' })

    const targetIdx = Number(amount) >= 0 ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) {
      return res.status(400).json({ error: 'Cannot move further in that direction' })
    }

    const entryA = sorted[idx]
    const entryB = sorted[targetIdx]

    // Swap join times so scoring changes
    const tempTime = entryA.join_time
    await db.query('UPDATE QueueEntry SET join_time = ? WHERE entry_id = ?', [entryB.join_time, entryA.entry_id])
    await db.query('UPDATE QueueEntry SET join_time = ? WHERE entry_id = ?', [tempTime, entryB.entry_id])

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to boost user' })
  }
})

// PUT /api/admin/queues/:serviceId/movetotop/:userId — move user to front
router.put('/api/admin/queues/:serviceId/movetotop/:userId', checkAdmin, async (req, res) => {
  try {
    const { serviceId, userId } = req.params

    const result = await getQueueForService(serviceId)
    if (!result) return res.status(404).json({ error: 'Queue not found' })

    const sorted = sortQueue(result.entries)
    if (sorted.length === 0) return res.status(400).json({ error: 'Queue is empty' })

    const entry = sorted.find((e) => e.entry_id == userId)
    if (!entry) return res.status(404).json({ error: 'User not found in queue' })

    // Backdate join_time so this entry scores highest
    const topScore = calcEffectiveScore(sorted[0])
    const neededWaitMin = topScore - PRIORITY_WEIGHTS[entry.priority] + 1
    const newJoinTime = new Date(Date.now() - neededWaitMin * 60000).toISOString()

    await db.query('UPDATE QueueEntry SET join_time = ? WHERE entry_id = ?', [newJoinTime, entry.entry_id])

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to move user to top' })
  }
})

// PUT /api/admin/queues/:serviceId/priority/:userId — change user priority
router.put('/api/admin/queues/:serviceId/priority/:userId', checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const { priority } = req.body

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Priority must be low, medium, or high' })
    }

    const [result] = await db.query('UPDATE QueueEntry SET priority = ? WHERE entry_id = ?', [priority, userId])
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found in queue' })

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to change priority' })
  }
})

module.exports = router