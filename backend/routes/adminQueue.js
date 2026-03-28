const express = require('express')
const store = require('../store')
const { checkAdmin } = require('../middleware/roleMiddleware')

const router = express.Router()

const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 }
const AGING_FACTOR = 1

function calcEffectiveScore(entry) {
  const waited = (Date.now() - new Date(entry.joinedAt).getTime()) / 60000
  return PRIORITY_WEIGHTS[entry.priority] + waited * AGING_FACTOR
}

function getRawQueue(serviceId) {
  if (!store.queue[serviceId]) store.queue[serviceId] = []
  return store.queue[serviceId]
}

function getSortedQueue(serviceId) {
  return [...getRawQueue(serviceId)].sort((a, b) => {
    const diff = calcEffectiveScore(b) - calcEffectiveScore(a)
    return diff !== 0 ? diff : new Date(a.joinedAt) - new Date(b.joinedAt)
  })
}

function enrichQueue(sorted, svc) {
  return sorted.map((entry, idx) => ({
    ...entry,
    position: idx + 1,
    score: parseFloat(calcEffectiveScore(entry).toFixed(1)),
    waitedMinutes: parseFloat(
      ((Date.now() - new Date(entry.joinedAt).getTime()) / 60000).toFixed(1)
    ),
    expectedWait: idx * (svc.expected || 10),
    boost: undefined,
  }))
}

function addNotif(notification) {
  store.notifications.unshift({
    id: `n${Date.now()}${Math.random()}`,
    read: false,
    ...notification,
  })
}

// GET /api/admin/queues — summary of all service queues
router.get('/api/admin/queues', checkAdmin, (_req, res) => {
  const summary = store.services.map((svc) => {
    const sorted = getSortedQueue(svc.id)
    return {
      serviceId: svc.id,
      serviceName: svc.name,
      open: svc.open,
      count: sorted.length,
      next: sorted[0] || null,
      expectedWait: sorted.length * (svc.expected || 10),
    }
  })
  return res.status(200).json(summary)
})

// GET /api/admin/queues/:serviceId — sorted queue for one service
router.get('/api/admin/queues/:serviceId', checkAdmin, (req, res) => {
  const svc = store.services.find((s) => s.id === req.params.serviceId)
  if (!svc) return res.status(404).json({ error: 'Service not found' })

  const sorted = getSortedQueue(req.params.serviceId)
  return res.status(200).json({ service: svc, queue: enrichQueue(sorted, svc) })
})

// GET /api/admin/history — full history (admin)
router.get('/api/admin/history', checkAdmin, (_req, res) => {
  return res.status(200).json([...store.history].reverse())
})

// POST /api/admin/queues/:serviceId/serve — serve next user
router.post('/api/admin/queues/:serviceId/serve', checkAdmin, (req, res) => {
  const { serviceId } = req.params
  const svc = store.services.find((s) => s.id === serviceId)
  if (!svc) return res.status(404).json({ error: 'Service not found' })

  const sorted = getSortedQueue(serviceId)
  if (sorted.length === 0) return res.status(400).json({ error: 'Queue is empty' })

  const next = sorted[0]
  store.queue[serviceId] = getRawQueue(serviceId).filter((e) => e.userId !== next.userId)

  const record = {
    id: `h${Date.now()}`,
    userId: next.userId,
    userName: next.userName,
    serviceId,
    serviceName: svc.name,
    priority: next.priority,
    joinedAt: next.joinedAt,
    servedAt: new Date().toISOString(),
    date: new Date().toISOString(),
    outcome: 'served',
  }
  store.history.push(record)

  // Notify the next 2 people in line
  const remaining = getSortedQueue(serviceId)
  remaining.slice(0, 2).forEach((entry, i) => {
    addNotif({
      type: 'almost',
      userId: entry.userId,
      message: `You are ${i === 0 ? 'next' : 'almost next'} in ${svc.name}!`,
    })
  })

  return res.status(200).json({ served: next, record })
})

// POST /api/admin/queues/:serviceId/walkin — add walk-in user
router.post('/api/admin/queues/:serviceId/walkin', checkAdmin, (req, res) => {
  const { serviceId } = req.params
  const { name, priority, phone, notes } = req.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' })
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or fewer' })
  }

  const svc = store.services.find((s) => s.id === serviceId)
  if (!svc) return res.status(404).json({ error: 'Service not found' })

  const entryPriority = ['low', 'medium', 'high'].includes(priority)
    ? priority
    : svc.priority || 'low'

  const entry = {
    userId: `walkin_${Date.now()}`,
    userName: name.trim(),
    priority: entryPriority,
    joinedAt: new Date().toISOString(),
    walkIn: true,
    phone: phone || '',
    notes: notes || '',
  }

  getRawQueue(serviceId).push(entry)
  addNotif({ type: 'walkin', message: `Walk-in "${name.trim()}" added to ${svc.name}` })
  return res.status(201).json(entry)
})

// DELETE /api/admin/queues/:serviceId/remove/:userId — remove user from queue
router.delete('/api/admin/queues/:serviceId/remove/:userId', checkAdmin, (req, res) => {
  const { serviceId, userId } = req.params
  if (!store.services.find((s) => s.id === serviceId)) {
    return res.status(404).json({ error: 'Service not found' })
  }

  const before = getRawQueue(serviceId).length
  store.queue[serviceId] = getRawQueue(serviceId).filter((e) => e.userId !== userId)
  return res.status(200).json({ success: true, removed: before > store.queue[serviceId].length })
})

// PUT /api/admin/queues/:serviceId/boost/:userId — move user one position up (amount>0) or down (amount<0)
router.put('/api/admin/queues/:serviceId/boost/:userId', checkAdmin, (req, res) => {
  const { serviceId, userId } = req.params
  const { amount } = req.body

  const sorted = getSortedQueue(serviceId)
  const idx = sorted.findIndex((e) => e.userId === userId)
  if (idx < 0) return res.status(404).json({ error: 'User not found in queue' })

  // positive amount = move up (swap with person above), negative = move down (swap with person below)
  const targetIdx = Number(amount) >= 0 ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= sorted.length) {
    return res.status(400).json({ error: 'Cannot move further in that direction' })
  }

  const raw = getRawQueue(serviceId)
  const entryA = raw.find((e) => e.userId === sorted[idx].userId)
  const entryB = raw.find((e) => e.userId === sorted[targetIdx].userId)
  if (!entryA || !entryB) return res.status(404).json({ error: 'Entry not found' })

  // Swap joinedAt and priority so the two entries fully trade positions
  const tempJoined = entryA.joinedAt
  const tempPriority = entryA.priority
  entryA.joinedAt = entryB.joinedAt
  entryA.priority = entryB.priority
  entryB.joinedAt = tempJoined
  entryB.priority = tempPriority

  return res.status(200).json({ success: true })
})

// PUT /api/admin/queues/:serviceId/movetotop/:userId — move user to front of queue
router.put('/api/admin/queues/:serviceId/movetotop/:userId', checkAdmin, (req, res) => {
  const { serviceId, userId } = req.params
  const sorted = getSortedQueue(serviceId)
  if (sorted.length === 0) return res.status(400).json({ error: 'Queue is empty' })

  const idx = sorted.findIndex((e) => e.userId === userId)
  if (idx < 0) return res.status(404).json({ error: 'User not found in queue' })
  if (idx === 0) return res.status(200).json({ success: true }) // already at top

  const raw = getRawQueue(serviceId)
  const entry = raw.find((e) => e.userId === userId)
  if (!entry) return res.status(404).json({ error: 'Entry not found' })

  // Give this entry a score just above the current #1 by backdating joinedAt.
  // Nobody else's data is touched, so positions 1..N-1 each shift down by one.
  const topScore = calcEffectiveScore(sorted[0])
  const neededWaitMin = topScore - PRIORITY_WEIGHTS[entry.priority] + 1
  entry.joinedAt = new Date(Date.now() - neededWaitMin * 60000).toISOString()

  return res.status(200).json({ success: true })
})

// PUT /api/admin/queues/:serviceId/priority/:userId — change user priority
router.put('/api/admin/queues/:serviceId/priority/:userId', checkAdmin, (req, res) => {
  const { serviceId, userId } = req.params
  const { priority } = req.body

  if (!['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'Priority must be low, medium, or high' })
  }

  const entry = getRawQueue(serviceId).find((e) => e.userId === userId)
  if (!entry) return res.status(404).json({ error: 'User not found in queue' })

  entry.priority = priority
  return res.status(200).json({ success: true, entry })
})

module.exports = router
