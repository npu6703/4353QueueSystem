const express = require('express')
const db = require('../db')
const { notifyAdmins } = require('../utils/notify')

const router = express.Router()

// ---------------------------------------------------------------------------
// Server-executed action: leave the user's current queue. Mirrors the SQL
// from routes/queue.js DELETE /api/queue/leave so behavior (cancel + reorder
// + notifications) is identical whether triggered via the Leave Queue button
// or via a chat command.
// ---------------------------------------------------------------------------
// Server-executed action: join the user to a specific service's queue.
// Mirrors POST /api/queue/join so behavior (open check, duplicate guard,
// position assignment, notifications) is identical to the regular flow.
async function executeJoinAction(userId, serviceId) {
  try {
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return { ok: false, reason: "I couldn't tell which service you meant — try naming one." }
    }

    // Refuse if user is already in ANY queue. The app keeps users to one queue
    // at a time; double-joining would leave a phantom record.
    const [active] = await db.query(
      `SELECT s.name AS serviceName
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status = 'waiting'
       LIMIT 1`,
      [userId]
    )
    if (active.length > 0) {
      return {
        ok: false,
        reason: `You're already in the ${active[0].serviceName} queue. Leave that one first.`,
      }
    }

    const [services] = await db.query(
      'SELECT service_id, name, priority, is_open FROM Service WHERE service_id = ?',
      [serviceId]
    )
    if (services.length === 0) return { ok: false, reason: 'That service does not exist.' }
    const svc = services[0]
    if (!svc.is_open) return { ok: false, reason: `${svc.name} is currently closed.` }

    const [queues] = await db.query('SELECT queue_id FROM Queue WHERE service_id = ?', [serviceId])
    if (queues.length === 0) return { ok: false, reason: 'No queue is set up for that service yet.' }
    const queueId = queues[0].queue_id

    const [profile] = await db.query(
      `SELECT up.full_name FROM UserCredentials uc
       LEFT JOIN UserProfile up ON uc.user_id = up.user_id WHERE uc.user_id = ?`,
      [userId]
    )
    const userName = profile[0]?.full_name || String(userId)
    const entryPriority = svc.priority || 'low'

    const [[{ maxPos }]] = await db.query(
      "SELECT IFNULL(MAX(position), 0) AS maxPos FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'",
      [queueId]
    )
    const position = maxPos + 1

    await db.query(
      `INSERT INTO QueueEntry (queue_id, user_id, user_name, position, priority, status)
       VALUES (?, ?, ?, ?, ?, 'waiting')`,
      [queueId, userId, userName, position, entryPriority]
    )

    try {
      await db.query(
        "INSERT INTO Notification (user_id, message, status) VALUES (?, ?, 'sent')",
        [userId, `You joined ${svc.name} queue (${entryPriority} priority)`]
      )
    } catch (notifErr) {
      console.error('Failed to insert join notification:', notifErr)
    }
    await notifyAdmins(`${userName} joined ${svc.name} queue via assistant (${entryPriority} priority)`)

    return { ok: true, serviceName: svc.name, position }
  } catch (err) {
    console.error('chat join action error:', err)
    return { ok: false, reason: 'Something went wrong while joining the queue.' }
  }
}

async function executeLeaveAction(userId) {
  try {
    const [entries] = await db.query(
      `SELECT qe.entry_id, qe.position, qe.queue_id, qe.user_name,
              s.service_id, s.name AS serviceName
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status = 'waiting'
       LIMIT 1`,
      [userId]
    )
    if (entries.length === 0) {
      return { ok: false, reason: 'You are not currently in any queue.' }
    }
    const entry = entries[0]

    await db.query(
      "UPDATE QueueEntry SET status = 'cancelled' WHERE entry_id = ?",
      [entry.entry_id]
    )
    await db.query(
      "UPDATE QueueEntry SET position = position - 1 WHERE queue_id = ? AND status = 'waiting' AND position > ?",
      [entry.queue_id, entry.position]
    )

    // Best-effort user notification (parity with the regular leave route).
    try {
      await db.query(
        "INSERT INTO Notification (user_id, message, status) VALUES (?, ?, 'sent')",
        [userId, `You left ${entry.serviceName} queue`]
      )
    } catch (notifErr) {
      console.error('Failed to insert leave notification:', notifErr)
    }
    await notifyAdmins(`${entry.user_name || `User ${userId}`} left ${entry.serviceName} queue (via assistant)`)

    return { ok: true, serviceName: entry.serviceName }
  } catch (err) {
    console.error('chat leave action error:', err)
    return { ok: false, reason: 'Something went wrong while leaving the queue.' }
  }
}

// ---------------------------------------------------------------------------
// LLM backend config — uses any OpenAI-compatible chat completions endpoint
// (Ollama, vLLM, LM Studio, llama.cpp server, etc). Reads from env so the
// deployment can be swapped without code changes.
//
// Required env vars:
//   LLM_BASE_URL   e.g. http://nitbox-server.tail4be60e.ts.net:11434
//   LLM_MODEL      e.g. gemma3:4b
// Optional:
//   LLM_API_KEY    Bearer token, only if the upstream needs auth
// ---------------------------------------------------------------------------
function getLlmConfig() {
  const baseUrl = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '')
  const model = process.env.LLM_MODEL
  const apiKey = process.env.LLM_API_KEY || null
  return { baseUrl, model, apiKey, configured: !!(baseUrl && model) }
}

// ---------------------------------------------------------------------------
// Auth: require a valid user-id header that maps to a real account. We don't
// enforce role here — admins are filtered out at the UI level, and even if
// they hit this endpoint manually it's harmless. The point is to prevent
// anonymous internet traffic from spending compute on the LLM server.
// ---------------------------------------------------------------------------
async function requireKnownUser(req, res, next) {
  try {
    const rawId = req.headers['user-id']
    const userId = Number(rawId)
    if (!rawId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Sign in required to use the assistant' })
    }
    const [rows] = await db.query('SELECT user_id FROM UserCredentials WHERE user_id = ?', [userId])
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Unknown user' })
    }
    req.userId = userId
    return next()
  } catch (err) {
    console.error('chat auth error:', err)
    return res.status(500).json({ error: 'Auth check failed' })
  }
}

// ---------------------------------------------------------------------------
// Rate limit: simple in-memory token bucket per userId. Each user gets
// MAX_REQUESTS in a rolling WINDOW_MS window. Single-process bucket — fine
// for this app, would need Redis for horizontal scaling.
// ---------------------------------------------------------------------------
const MAX_REQUESTS = 8
const WINDOW_MS = 60_000
const buckets = new Map()

function rateLimit(req, res, next) {
  const now = Date.now()
  const arr = buckets.get(req.userId) || []
  const recent = arr.filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000)
    res.setHeader('Retry-After', String(retryAfter))
    return res.status(429).json({
      error: `Too many requests. Try again in ${retryAfter}s.`,
    })
  }
  recent.push(now)
  buckets.set(req.userId, recent)
  return next()
}

function _resetRateLimit() {
  buckets.clear()
}

async function getQueueContext(serviceId) {
  try {
    const [services] = await db.query(
      'SELECT service_id AS id, name, description, expected_duration AS expected, is_open AS `open` FROM Service'
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
  } catch (err) {
    console.error('chat queue-context error:', err)
    return { services: [], focusedService: null }
  }
}

// Same priority+aging algorithm queue.js uses for /api/queue/status. Keeps
// chat answers consistent with what the user sees in the Status page.
const PRIORITY_WEIGHTS = { high: 30, medium: 15, low: 0 }
const AGING_FACTOR = 1

function calcScore(priority, joinTime) {
  const waitedMin = (Date.now() - new Date(joinTime).getTime()) / 60000
  return (PRIORITY_WEIGHTS[priority] || 0) + waitedMin * AGING_FACTOR
}

async function getUserContext(userId) {
  if (!userId) return null
  try {
    // Profile (always returned so the bot can address the user by name)
    const [profile] = await db.query(
      `SELECT up.full_name, up.phone, uc.email
       FROM UserCredentials uc
       LEFT JOIN UserProfile up ON uc.user_id = up.user_id
       WHERE uc.user_id = ?`,
      [userId]
    )
    const fullName = profile[0]?.full_name || ''
    const email = profile[0]?.email || ''

    // Active entry (if any)
    const [entries] = await db.query(
      `SELECT qe.entry_id, qe.priority, qe.join_time, qe.queue_id,
              s.name AS serviceName, s.expected_duration AS expected
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status = 'waiting'
       LIMIT 1`,
      [userId]
    )

    // Recent history (last 5 served/cancelled entries)
    const [history] = await db.query(
      `SELECT s.name AS serviceName, qe.status, qe.join_time
       FROM QueueEntry qe
       JOIN Queue q ON qe.queue_id = q.queue_id
       JOIN Service s ON q.service_id = s.service_id
       WHERE qe.user_id = ? AND qe.status IN ('served','cancelled')
       ORDER BY qe.join_time DESC
       LIMIT 5`,
      [userId]
    )

    let active = null
    if (entries.length > 0) {
      const entry = entries[0]
      // Pull all waiting entries to compute position dynamically with the
      // priority+aging algorithm (same as /api/queue/status). The stored
      // qe.position column gets stale after admin reorder/serve.
      const [allWaiting] = await db.query(
        `SELECT entry_id, priority, join_time
         FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'`,
        [entry.queue_id]
      )
      const sorted = [...allWaiting].sort((a, b) => {
        const diff = calcScore(b.priority, b.join_time) - calcScore(a.priority, a.join_time)
        return diff !== 0 ? diff : new Date(a.join_time) - new Date(b.join_time)
      })
      const position = sorted.findIndex((e) => Number(e.entry_id) === Number(entry.entry_id)) + 1
      const total = allWaiting.length
      const duration = entry.expected || 10

      active = {
        serviceName: entry.serviceName,
        position,
        totalInQueue: total,
        priority: entry.priority,
        // Same formula as queue.js GET /status: people-ahead × duration.
        estimatedRemainingWait: (position - 1) * duration,
      }
    }

    return {
      fullName,
      email,
      active,
      history: history.map((h) => ({
        serviceName: h.serviceName,
        outcome: h.status,
        when: h.join_time,
      })),
    }
  } catch (err) {
    console.error('chat user-context error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Call any OpenAI-compatible /v1/chat/completions endpoint and return the
// assistant's reply string. Throws on HTTP error so the route's catch can map
// to a 500 with our generic message.
// ---------------------------------------------------------------------------
async function callLlm({ baseUrl, model, apiKey, system, messages, maxTokens, signal }) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
    max_tokens: maxTokens,
    // Lower temperature → more deterministic. With short replies + clear data,
    // we don't want creative variation — we want the model to parrot the
    // precomputed numbers verbatim.
    temperature: 0.2,
    stream: false,
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`LLM upstream ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const reply = data?.choices?.[0]?.message?.content
  if (!reply || typeof reply !== 'string') {
    throw new Error('LLM returned an empty or malformed response')
  }
  return reply.trim()
}

// ---------------------------------------------------------------------------
// Server-side intent detection (runs BEFORE the LLM)
//
// Small local models (gemma3:4b) are unreliable at "emit this exact token"
// instructions — they often roleplay an action without emitting the trigger.
// To make actions deterministic, we keyword-match the user's literal message
// here. If we recognize a clear command, we execute the action server-side
// and inject the result into the model's context as ground truth. The model
// then just generates a natural-language confirmation.
//
// Conservative on purpose — only matches imperatives, never questions
// ("how do I leave?", "can you join?"). Bilingual (English / Spanish).
// ---------------------------------------------------------------------------
function detectIntent(message, services) {
  const m = String(message || '').toLowerCase().trim()

  // Question patterns short-circuit — "how do I leave" / "can you join" are
  // informational, not commands.
  const questionPrefixes = /^(how|why|when|where|what|do you|can you|could you|would you|qué|cómo|cuándo|por qué|puedes|podrías)\b/
  if (questionPrefixes.test(m) || m.includes('?') || m.includes('¿')) return null

  const leavePatterns = [
    /\bleave (the |my |this )?(queue|line)\b/,
    /\bremove me\b/,
    /\bcancel (my |the )?(spot|queue|line|position)\b/,
    /\b(get|take) me out\b/,
    // Spanish
    /\bsácame\b/,
    /\bsalir de la (cola|fila|línea)\b/,
    /\bquítame\b/,
    /\bcancela mi (puesto|posición|lugar|cola)\b/,
  ]
  if (leavePatterns.some((rx) => rx.test(m))) {
    return { kind: 'leave' }
  }

  const isJoinVerb = /\b(join|put me|add me|sign me up|métame|ponme|agrégame|inscríbeme|únete|unirme)\b/.test(m)
  if (isJoinVerb) {
    // Try to match a service name from the live list.
    const named = services.find((s) => {
      const nameLc = s.name.toLowerCase()
      return m.includes(nameLc) || m.includes(nameLc.replace(/-/g, ' '))
    })
    if (named) return { kind: 'join', serviceId: named.id, serviceName: named.name }
    // Join intent without a clear target — let the model ask which service.
    return { kind: 'join', serviceId: null, serviceName: null }
  }

  return null
}

// Action sentinel tokens — kept for backward compat in case the model still
// emits them, but the server-side intent path above is the primary mechanism.
const LEAVE_TOKEN_RX = /<<\s*ACTION\s*:\s*LEAVE_QUEUE\s*>>/i
const JOIN_TOKEN_RX = /<<\s*ACTION\s*:\s*JOIN_QUEUE\s*:\s*(\d+)\s*>>/i

// Strip ANY action token (including malformed/unknown variants) so we never
// leak raw `<<ACTION:...>>` strings to the user.
const ANY_TOKEN_RX = /<<\s*ACTION\s*:[^>]*>>/gi

function stripAllTokens(text) {
  return text.replace(ANY_TOKEN_RX, '').trim()
}

/**
 * Inspect the model's reply for an action token. If present, execute the
 * action server-side and replace the reply with one that reflects the real
 * outcome. Tokens are always stripped so the user never sees them.
 *
 * @param {string} reply Raw LLM reply
 * @param {number} userId Authenticated user
 * @param {boolean} userIsInQueue Whether the user had an active entry when
 *   the request started.
 */
async function maybeExecuteAction(reply, userId, userIsInQueue) {
  // LEAVE
  if (LEAVE_TOKEN_RX.test(reply)) {
    const stripped = stripAllTokens(reply)
    if (!userIsInQueue) {
      return "You're not currently in any queue, so there's nothing to leave."
    }
    const result = await executeLeaveAction(userId)
    if (result.ok) {
      // Trust the model's confirmation only on actual success.
      return stripped || `Done — I've removed you from the ${result.serviceName} queue.`
    }
    return result.reason || "I couldn't leave the queue. Please try the Leave Queue button."
  }

  // JOIN
  const joinMatch = reply.match(JOIN_TOKEN_RX)
  if (joinMatch) {
    const stripped = stripAllTokens(reply)
    const serviceId = Number(joinMatch[1])
    const result = await executeJoinAction(userId, serviceId)
    if (result.ok) {
      return stripped || `Done — you're now in the ${result.serviceName} queue (position #${result.position}).`
    }
    return result.reason || "I couldn't join you to that queue."
  }

  // No tokens — pass through. Still strip in case the model emitted a
  // malformed variant we don't recognise.
  return ANY_TOKEN_RX.test(reply) ? stripAllTokens(reply) : reply
}

// POST /api/chat
router.post('/api/chat', requireKnownUser, rateLimit, async (req, res) => {
  try {
    const { message, serviceId, history = [] } = req.body
    if (!message || typeof message !== 'string' || message.trim().length === 0)
      return res.status(400).json({ error: 'Message is required' })
    if (message.trim().length > 500)
      return res.status(400).json({ error: 'Message too long (max 500 characters)' })

    const cfg = getLlmConfig()
    if (!cfg.configured) {
      return res.status(503).json({ error: 'AI assistant is not configured yet' })
    }

    const userId = req.userId

    const [{ services, focusedService }, userCtx] = await Promise.all([
      getQueueContext(serviceId),
      getUserContext(userId),
    ])

    // Intent detection BEFORE the LLM. Local 4B models are flaky at emitting
    // exact tokens, so we recognise clear leave/join commands ourselves and
    // bypass the LLM with a deterministic confirmation. Only ambiguous /
    // conversational messages get forwarded to the LLM.
    const intent = detectIntent(message, services)
    if (intent?.kind === 'leave') {
      if (!userCtx?.active) {
        return res.status(200).json({ reply: "You're not currently in any queue, so there's nothing to leave." })
      }
      const r = await executeLeaveAction(userId)
      const reply = r.ok
        ? `Done — I've removed you from the ${r.serviceName} queue.`
        : (r.reason || "I couldn't leave the queue. Please try the Leave Queue button.")
      return res.status(200).json({ reply })
    }
    if (intent?.kind === 'join' && intent.serviceId) {
      const r = await executeJoinAction(userId, intent.serviceId)
      const reply = r.ok
        ? `Done — you're now in the ${r.serviceName} queue at position #${r.position}.`
        : (r.reason || "I couldn't join you to that queue.")
      return res.status(200).json({ reply })
    }
    if (intent?.kind === 'join' && !intent.serviceId) {
      // Join requested but no service named — short, helpful nudge.
      const open = services.filter((s) => s.open).map((s) => s.name).join(', ')
      const reply = open
        ? `Which one? Open services right now: ${open}.`
        : "There are no open services to join right now."
      return res.status(200).json({ reply })
    }

    const openServices = services.filter((s) => s.open)
    const shortestWait = openServices.length
      ? openServices.reduce((a, b) => (a.estimatedWait <= b.estimatedWait ? a : b))
      : null

    // Compose the user-facing fact sheet. We put the user's own status FIRST
    // and most prominently so the model anchors on it. The services list is
    // labeled "join wait" (what a NEWCOMER would wait) so the model doesn't
    // confuse the per-service number with the user's actual wait.
    const userBlock = !userCtx
      ? 'User profile unavailable.'
      : userCtx.active
        ? `Name: ${userCtx.fullName || '(no name on file)'}
Email: ${userCtx.email || '(none)'}

>>> THE USER'S WAIT TIME IS EXACTLY ${userCtx.active.estimatedRemainingWait} MINUTES. <<<
>>> Use this number, not the join-wait below. <<<

Currently in line for: ${userCtx.active.serviceName}
Position: #${userCtx.active.position} out of ${userCtx.active.totalInQueue} people`
        : `Name: ${userCtx.fullName || '(no name on file)'}
Email: ${userCtx.email || '(none)'}

The user is NOT currently in any queue.`

    const historyBlock = !userCtx || userCtx.history.length === 0
      ? 'No past visits on record.'
      : userCtx.history.map((h) =>
          `  - ${h.serviceName} (${h.outcome}) on ${new Date(h.when).toLocaleString()}`
        ).join('\n')

    const systemPrompt = `You are QueueSmart Assistant — a smart, friendly AI built into the QueueSmart queue management system.
You help users understand wait times, choose the best service to join, and track their queue position.

--- USER STATUS (most important) ---
${userBlock}

--- USER'S RECENT HISTORY ---
${historyBlock}

--- ALL SERVICES (id is needed for the JOIN action) ---
${
  services.length === 0
    ? 'No services are available right now.'
    : services.map((s) => {
        const status = s.open ? 'OPEN' : 'CLOSED (admin disabled it)'
        const desc = s.description ? ` — ${s.description}` : ''
        const waitStr = s.open
          ? `${s.waitingCount} in line, join wait ~${s.estimatedWait} min`
          : 'not accepting new people'
        return `• id=${s.id} ${s.name}${desc} [${status}] — ${waitStr}`
      }).join('\n')
}
${focusedService ? `\nUser is currently on the ${focusedService.name} page.` : ''}
${
  // Only mention "shortest join wait" if the user is NOT already in a queue.
  // Otherwise the model gets confused and volunteers it alongside the user's
  // own (unrelated) wait time, which reads as a contradiction.
  !userCtx?.active && shortestWait && shortestWait.estimatedWait !== undefined
    ? `\nShortest join wait among open services: ${shortestWait.name} (~${shortestWait.estimatedWait} min)`
    : ''
}

--- END DATA ---

About the system (use when asked):
- Wait times only go down when someone is served — not as a real-time clock.
- A CLOSED service means an admin temporarily disabled it; users cannot join until it's reopened.
- To leave a queue, click the "Leave Queue" button on the Status or Join page.
- Priority levels are low / medium / high. High-priority is served sooner; long waits also boost a user's score (aging) so nobody gets stuck.

How to respond:
- Be friendly and helpful, like a concierge. Match the user's language (English / Spanish).
- Reply in 2-4 sentences. Concise, but answer the question fully.
- Use the user's name when natural.
- CRITICAL — when the user asks ANYTHING about THEIR own wait, position, or status,
  copy the number between ">>> ... <<<" markers EXACTLY. Do NOT use the "join wait"
  numbers from the services list — those are for NEW people, not the current user.
- NEVER multiply, add, or recompute. position × duration is WRONG. Use only the
  precomputed numbers shown in the data.
- ANSWER ONLY WHAT WAS ASKED. Don't volunteer wait times the user didn't request.
  If the user is already in a queue and asks about their status, do NOT mention
  "join wait" of any service — that's only relevant for people deciding which
  queue to join.
- For "leave the queue" requests → SEE THE ACTION SECTION BELOW.
- For "my history" → use the Recent History list.
- For "my name / email" → from User Status.
- For "why is X closed" → an admin disabled it.
- For "why doesn't time go down in real time" → it only updates when the queue moves.
- Only refuse for truly off-topic questions (weather, politics, jokes): say
  "I can only help with QueueSmart — wait times, services, your queue, and your history."

ACTIONS YOU CAN PERFORM
You can actually do things for the user by emitting one of these tokens at the
START of your reply (the token is hidden from the user; it triggers the action):

1. LEAVE the user's current queue:
   Token: <<ACTION:LEAVE_QUEUE>>
   Use ONLY when the user clearly REQUESTS it — e.g. "leave the queue",
   "remove me", "cancel my spot", "sácame de la cola".
   Do NOT use for "how do I leave?" or "can you leave?" — those are
   informational and you should explain the Leave Queue button instead.
   Do NOT use if the user is NOT currently in a queue.

2. JOIN the user into a specific service's queue:
   Token: <<ACTION:JOIN_QUEUE:N>>  where N is the service id from the list above.
   Example: <<ACTION:JOIN_QUEUE:2>> Sure, I've added you to Dine-in.
   Use ONLY when:
     - The user explicitly asks to join (e.g. "join Dine-in", "put me in line for X",
       "métame a la cola de Y", "join the queue for Dine-in").
     - You can identify a SPECIFIC service. If the user said only "join the queue"
       without naming one, ASK which service first — do NOT use the token.
     - The service is OPEN.
     - The user is NOT already in any queue.
   If unsure, ASK rather than guess.

GENERAL TOKEN RULES
- Emit AT MOST ONE action token per reply.
- Don't combine action tokens in a single reply.
- After the token, write ONE short confirmation sentence.
- If the user is replying "yes" / "sí" to a question YOU asked in your previous
  turn, look at THAT prior turn carefully:
    - If you asked "should I add you to Dine-in?" then "yes" → emit JOIN token.
    - If you asked "should I leave?" then "yes" → emit LEAVE token.
    - If you didn't ask anything actionable, treat "yes" as a casual
      acknowledgement — DO NOT emit any action token.`

    // Cap history at 4 turns and truncate any single message to 500 chars.
    // Both bounds protect token cost and stop a malicious client from
    // smuggling a giant prior message via the history field.
    const trimmedHistory = history
      .slice(-4)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 500),
      }))
      .filter((m) => m.content.length > 0)

    const messages = [...trimmedHistory, { role: 'user', content: message.trim() }]

    // Abort the upstream call if it stalls — local LLMs sometimes hang on cold
    // starts. 30s is enough headroom for the first request to load the model
    // into memory.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)

    try {
      let reply = await callLlm({
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        apiKey: cfg.apiKey,
        system: systemPrompt,
        messages,
        // 200 tokens ≈ 150 words ≈ 2-4 sentences — enough for an informative
        // concierge reply (name + service description + wait + advice) without
        // letting the model ramble.
        maxTokens: 200,
        signal: controller.signal,
      })

      // The model can request a server-side action by emitting a sentinel
      // token. Parse it BEFORE returning so the user only sees the cleaned
      // reply, never the raw token.
      reply = await maybeExecuteAction(reply, userId, !!userCtx?.active)

      return res.status(200).json({ reply })
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    console.error('Chat error:', err.message || err)
    return res.status(500).json({ error: 'AI assistant is temporarily unavailable' })
  }
})

module.exports = router
module.exports._resetRateLimit = _resetRateLimit
module.exports._MAX_REQUESTS = MAX_REQUESTS
