const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const db = require('../db')

const router = express.Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

async function getQueueContext(serviceId) {
  try {
    const [services] = await db.query(
      'SELECT service_id AS id, name, description, expected_duration AS expected, is_open AS open FROM Service'
    )

    const serviceDetails = await Promise.all(
      services.map(async (svc) => {
        const [queues] = await db.query('SELECT queue_id FROM Queue WHERE service_id = ?', [svc.id])
        if (queues.length === 0) return { ...svc, waitingCount: 0, estimatedWait: 0 }
        const [entries] = await db.query(
          "SELECT COUNT(*) AS cnt FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'",
          [queues[0].queue_id]
        )
        const count = entries[0].cnt
        return {
          id: svc.id,
          name: svc.name,
          description: svc.description,
          open: !!svc.open,
          expectedDurationPerPerson: svc.expected || 10,
          waitingCount: count,
          estimatedWait: count * (svc.expected || 10),
        }
      })
    )

    const focusedService = serviceId
      ? serviceDetails.find((s) => s.id == serviceId)
      : null

    return { services: serviceDetails, focusedService }
  } catch {
    return { services: [], focusedService: null }
  }
}

async function getUserContext(userId) {
  if (!userId) return null
  try {
    const [rows] = await db.query(
      `SELECT qe.position, qe.priority, qe.join_time,
              s.name AS serviceName, s.expected_duration AS expected,
              (SELECT COUNT(*) FROM QueueEntry qe2 WHERE qe2.queue_id = qe.queue_id AND qe2.status = 'waiting') AS totalInQueue
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status = 'waiting'
       LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) return null
    const row = rows[0]
    const waitedMin = Math.round((Date.now() - new Date(row.join_time).getTime()) / 60000)
    const remaining = row.totalInQueue - row.position
    return {
      serviceName: row.serviceName,
      position: row.position,
      totalInQueue: row.totalInQueue,
      priority: row.priority,
      waitedMinutes: waitedMin,
      estimatedRemainingWait: remaining * (row.expected || 10),
    }
  } catch {
    return null
  }
}

// POST /api/chat
router.post('/api/chat', async (req, res) => {
  try {
    const { message, serviceId, userId, history = [] } = req.body
    if (!message || typeof message !== 'string' || message.trim().length === 0)
      return res.status(400).json({ error: 'Message is required' })
    if (message.trim().length > 500)
      return res.status(400).json({ error: 'Message too long (max 500 characters)' })
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ error: 'AI assistant is not configured yet' })

    const [{ services, focusedService }, userCtx] = await Promise.all([
      getQueueContext(serviceId),
      getUserContext(userId),
    ])

    const openServices = services.filter((s) => s.open)
    const shortestWait = openServices.length
      ? openServices.reduce((a, b) => (a.estimatedWait <= b.estimatedWait ? a : b))
      : null

    const systemPrompt = `You are QueueSmart Assistant, a helpful AI for a smart queue management system.
Your job: answer questions about queue status, wait times, and help users make smart decisions about which service to join.

Current system snapshot:
${
  services.length === 0
    ? '- No services available right now.'
    : services
        .map(
          (s) =>
            `- ${s.name} (${s.open ? 'OPEN' : 'CLOSED'}): ${s.waitingCount} people waiting, ~${s.estimatedWait} min estimated wait`
        )
        .join('\n')
}
${focusedService ? `\nCurrently viewing: ${focusedService.name}` : ''}
${shortestWait ? `\nShortest wait right now: ${shortestWait.name} (~${shortestWait.estimatedWait} min)` : ''}
${
  userCtx
    ? `\nUser's current queue info:
- Service: ${userCtx.serviceName}
- Position: ${userCtx.position} of ${userCtx.totalInQueue}
- Priority: ${userCtx.priority}
- Already waited: ${userCtx.waitedMinutes} min
- Estimated remaining wait: ~${userCtx.estimatedRemainingWait} min`
    : '\nUser is not currently in any queue.'
}

Rules:
- Be concise and friendly (2-4 sentences max per reply)
- Give concrete numbers and actionable advice
- If a user asks about best time to join, mention the current shortest-wait service
- Never make up data — only use what's in the snapshot above
- Do not discuss topics unrelated to queue management`

    const messages = [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message.trim() },
    ]

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0]?.text || 'Sorry, I could not generate a response.'
    return res.status(200).json({ reply })
  } catch (err) {
    console.error('Chat error:', err)
    return res.status(500).json({ error: 'AI assistant is temporarily unavailable' })
  }
})

module.exports = router
