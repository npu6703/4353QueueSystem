const express = require('express')
const db = require('../db')
const { checkAdmin } = require('../middleware/roleMiddleware')

const router = express.Router()
const VALID_PRIORITIES = ['low', 'medium', 'high']

function validateServiceFields(body, requireAll) {
  const { name, description, expected, priority } = body
  const errors = {}

  if (requireAll || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.name = 'Service name is required'
    } else if (name.trim().length > 100) {
      errors.name = 'Service name must be 100 characters or fewer'
    }
  }

  if (requireAll || description !== undefined) {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      errors.description = 'Description is required'
    } else if (description.trim().length > 500) {
      errors.description = 'Description must be 500 characters or fewer'
    }
  }

  if (requireAll || expected !== undefined) {
    const dur = Number(expected)
    if (expected === undefined || expected === '' || isNaN(dur) || dur < 1 || dur > 480) {
      errors.expected = 'Expected duration must be between 1 and 480 minutes'
    }
  }

  if (requireAll || priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) {
      errors.priority = 'Priority must be low, medium, or high'
    }
  }

  return errors
}

// GET /api/services — list all services (public)
router.get('/api/services', async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.service_id AS id, s.name, s.description,
             s.expected_duration AS expected, s.priority, s.is_open AS \`open\`,
             COUNT(qe.entry_id) AS queueCount
      FROM Service s
      LEFT JOIN Queue q ON q.service_id = s.service_id
      LEFT JOIN QueueEntry qe ON qe.queue_id = q.queue_id AND qe.status = 'waiting'
      GROUP BY s.service_id`)
    const parsed = rows.map(r => ({ ...r, queueCount: Number(r.queueCount) }))
    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch services' })
  }
})

// GET /api/services/:id — get one service (public)
router.get('/api/services/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
  'SELECT service_id AS id, name, description, expected_duration AS expected, priority, is_open AS `open` FROM Service WHERE service_id = ?',
  [req.params.id])
if (rows.length === 0) return res.status(404).json({ error: 'Service not found' })
    return res.status(200).json(rows[0])
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch service' })
  }
})

// POST /api/admin/services — create service (admin)
router.post('/api/admin/services', checkAdmin, async (req, res) => {
  const errs = validateServiceFields(req.body, true)
  if (Object.keys(errs).length > 0) {
    return res.status(400).json({ error: Object.values(errs)[0], errors: errs })
  }

  const { name, description, expected, priority } = req.body

  try {
    const [result] = await db.query(
      'INSERT INTO Service (name, description, expected_duration, priority) VALUES (?, ?, ?, ?)',
      [name.trim(), description.trim(), Number(expected), priority]
    )
    const serviceId = result.insertId
    await db.query('INSERT INTO Queue (service_id) VALUES (?)', [serviceId])
    return res.status(201).json({ id: serviceId, name: name.trim(), description: description.trim(), expected: Number(expected), priority, open: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create service' })
  }
})

// PUT /api/admin/services/:id — update service (admin)
router.put('/api/admin/services/:id', checkAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Service WHERE service_id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' })

    const errs = validateServiceFields(req.body, false)
    if (Object.keys(errs).length > 0) {
      return res.status(400).json({ error: Object.values(errs)[0], errors: errs })
    }

    const { name, description, expected, priority } = req.body
    const current = rows[0]

    await db.query(
      'UPDATE Service SET name = ?, description = ?, expected_duration = ?, priority = ? WHERE service_id = ?',
      [
        name !== undefined ? name.trim() : current.name,
        description !== undefined ? description.trim() : current.description,
        expected !== undefined ? Number(expected) : current.expected_duration,
        priority !== undefined ? priority : current.priority,
        req.params.id,
      ]
    )

    const [updated] = await db.query(
  'SELECT service_id AS id, name, description, expected_duration AS expected, priority, is_open AS `open` FROM Service WHERE service_id = ?',
  [req.params.id]
)
return res.status(200).json(updated[0])
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update service' })
  }
})

// DELETE /api/admin/services/:id — delete service (admin)
router.delete('/api/admin/services/:id', checkAdmin, async (req, res) => {
  const conn = await db.getConnection()
  try {
    const [rows] = await conn.query('SELECT * FROM Service WHERE service_id = ?', [req.params.id])
    if (rows.length === 0) {
      conn.release()
      return res.status(404).json({ error: 'Service not found' })
    }

    await conn.beginTransaction()

    // Find all queues for this service
    const [queues] = await conn.query('SELECT queue_id FROM Queue WHERE service_id = ?', [req.params.id])
    const queueIds = queues.map(q => q.queue_id)

    // Delete QueueEntry rows first (child of Queue)
    if (queueIds.length > 0) {
      await conn.query('DELETE FROM QueueEntry WHERE queue_id IN (?)', [queueIds])
    }

    // Delete Queue rows (child of Service)
    await conn.query('DELETE FROM Queue WHERE service_id = ?', [req.params.id])

    // Now safe to delete the Service
    await conn.query('DELETE FROM Service WHERE service_id = ?', [req.params.id])

    await conn.commit()
    conn.release()
    return res.status(200).json({ success: true })
  } catch (err) {
    await conn.rollback().catch(() => {})
    conn.release()
    return res.status(500).json({ error: 'Failed to delete service' })
  }
})

// PUT /api/admin/services/:id/toggle — toggle open/closed via Queue table (admin)
router.put('/api/admin/services/:id/toggle', checkAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Service WHERE service_id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Service not found' })

    const newOpen = !rows[0].is_open
    await db.query('UPDATE Service SET is_open = ? WHERE service_id = ?', [newOpen, req.params.id])

    return res.status(200).json({ ...rows[0], id: rows[0].service_id, open: newOpen })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle service' })
  }
})

module.exports = router