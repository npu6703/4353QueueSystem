const express = require('express')
const store = require('../store')
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
router.get('/api/services', (_req, res) => {
  return res.status(200).json(store.services)
})

// GET /api/services/:id — get one service (public)
router.get('/api/services/:id', (req, res) => {
  const svc = store.services.find((s) => s.id === req.params.id)
  if (!svc) return res.status(404).json({ error: 'Service not found' })
  return res.status(200).json(svc)
})

// POST /api/admin/services — create service (admin)
router.post('/api/admin/services', checkAdmin, (req, res) => {
  const errs = validateServiceFields(req.body, true)
  if (Object.keys(errs).length > 0) {
    return res.status(400).json({ error: Object.values(errs)[0], errors: errs })
  }

  const { name, description, expected, priority, open } = req.body
  const service = {
    id: `s${Date.now()}`,
    name: name.trim(),
    description: description.trim(),
    expected: Number(expected),
    priority,
    open: open !== false,
  }

  store.services.push(service)
  return res.status(201).json(service)
})

// PUT /api/admin/services/:id — update service (admin)
router.put('/api/admin/services/:id', checkAdmin, (req, res) => {
  const idx = store.services.findIndex((s) => s.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Service not found' })

  const errs = validateServiceFields(req.body, false)
  if (Object.keys(errs).length > 0) {
    return res.status(400).json({ error: Object.values(errs)[0], errors: errs })
  }

  const { name, description, expected, priority, open } = req.body
  store.services[idx] = {
    ...store.services[idx],
    ...(name !== undefined && { name: name.trim() }),
    ...(description !== undefined && { description: description.trim() }),
    ...(expected !== undefined && { expected: Number(expected) }),
    ...(priority !== undefined && { priority }),
    ...(open !== undefined && { open }),
  }

  return res.status(200).json(store.services[idx])
})

// DELETE /api/admin/services/:id — delete service (admin)
router.delete('/api/admin/services/:id', checkAdmin, (req, res) => {
  const idx = store.services.findIndex((s) => s.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Service not found' })

  store.services.splice(idx, 1)
  delete store.queue[req.params.id]
  return res.status(200).json({ success: true })
})

// PUT /api/admin/services/:id/toggle — toggle open/closed (admin)
router.put('/api/admin/services/:id/toggle', checkAdmin, (req, res) => {
  const svc = store.services.find((s) => s.id === req.params.id)
  if (!svc) return res.status(404).json({ error: 'Service not found' })

  svc.open = !svc.open
  return res.status(200).json(svc)
})

module.exports = router
