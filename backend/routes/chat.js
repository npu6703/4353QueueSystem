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

    const systemPrompt = `You are QueueSmart Assistant — a smart, friendly AI built into the QueueSmart queue management system.
You help users understand wait times, choose the best service to join, and track their queue position.

--- LIVE QUEUE DATA ---
${
  services.length === 0
    ? 'No services are available right now.'
    : services.map((s) => {
        const status = s.open ? 'OPEN' : 'CLOSED'
        const waitStr = s.open ? `${s.waitingCount} waiting, ~${s.estimatedWait} min est. wait` : 'not accepting queue'
        return `• ${s.name} [${status}] — ${waitStr}`
      }).join('\n')
}
${focusedService ? `\nUser is currently on the ${focusedService.name} page.` : ''}
${shortestWait && shortestWait.estimatedWait !== undefined
  ? `\nBest option right now: ${shortestWait.name} (~${shortestWait.estimatedWait} min wait)`
  : ''}
${userCtx
  ? `\n--- USER'S CURRENT QUEUE ---
Service: ${userCtx.serviceName}
Position: #${userCtx.position} out of ${userCtx.totalInQueue} people
Priority level: ${userCtx.priority}
Already waited: ${userCtx.waitedMinutes} min
Estimated time until served: ~${userCtx.estimatedRemainingWait} min`
  : '\nThis user is not currently in any queue.'}
--- END DATA ---

How to respond:
- Be warm, helpful, and direct — like a knowledgeable concierge
- Always use the real numbers from the data above
- For wait time questions: give the estimated remaining wait if user is in a queue, otherwise give the join wait for the service they're asking about
- For "which service is best": recommend the open one with the shortest wait, explain why
- For "should I join now": give a clear yes/no with a reason based on current wait times
- For position questions: tell them exactly where they are and roughly when they'll be served
- Keep replies to 2-4 sentences — clear and actionable
- If asked something outside of queue management, politely redirect
- Never invent data that isn't in the snapshot above`

    const messages = [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message.trim() },
    ]

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
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
