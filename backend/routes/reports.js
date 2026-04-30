const express = require('express');
const db = require('../db');
const { checkAdmin } = require('../middleware/roleMiddleware');
const { toCsv, sendCsv } = require('../utils/csv');

const router = express.Router();

// ---------------------------------------------------------------------------
// Reporting module
//
// All endpoints are admin-protected. Each report supports:
//   - JSON output (default) for in-page rendering
//   - CSV output via ?format=csv for download
//   - Optional date range filters via ?from=YYYY-MM-DD&to=YYYY-MM-DD
//   - Per-service filter via ?serviceId=N (where applicable)
//
// The wait-time metric is computed from served entries:
//   waitMinutes = (servedAt - join_time) in minutes.
// We don't store servedAt in the schema, so we approximate "served wait" by the
// difference between join_time and the (much later) read time. To keep things
// honest and reproducible we instead expose the *queue-time so far* for served
// entries by treating serve as "now" — this matches the dynamic estimate that
// the rest of the app uses and avoids lying about precision we don't have.
// ---------------------------------------------------------------------------

const VALID_FORMATS = new Set(['json', 'csv']);

function parseDateFilters(req) {
  const filters = {};
  const from = req.query.from;
  const to = req.query.to;
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) filters.from = from;
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) filters.to = to;
  return filters;
}

function pickFormat(req) {
  const f = String(req.query.format || 'json').toLowerCase();
  return VALID_FORMATS.has(f) ? f : 'json';
}

function buildDateClause(alias, filters) {
  const clauses = [];
  const params = [];
  if (filters.from) {
    clauses.push(`${alias}.join_time >= ?`);
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    clauses.push(`${alias}.join_time <= ?`);
    params.push(`${filters.to} 23:59:59`);
  }
  return { clauses, params };
}

// ---------------------------------------------------------------------------
// Whitelisted query-param filters. Anything not in the allow-list is silently
// ignored — never interpolate raw user input into SQL.
// ---------------------------------------------------------------------------
const ALLOWED_STATUS = new Set(['waiting', 'served', 'cancelled']);
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high']);
const ALLOWED_ROLE = new Set(['user', 'admin']);

function parseStatus(req) {
  const v = String(req.query.status || '').toLowerCase();
  return ALLOWED_STATUS.has(v) ? v : null;
}
function parsePriority(req) {
  const v = String(req.query.priority || '').toLowerCase();
  return ALLOWED_PRIORITY.has(v) ? v : null;
}
function parseRole(req) {
  const v = String(req.query.role || '').toLowerCase();
  return ALLOWED_ROLE.has(v) ? v : null;
}
function parseWalkIn(req) {
  const v = String(req.query.walkIn || '').toLowerCase();
  if (v === 'true' || v === '1') return 1;
  if (v === 'false' || v === '0') return 0;
  return null;
}

// ============================================================================
// GET /api/admin/reports/users
// One row per user with their queue participation summary.
// ============================================================================
router.get('/api/admin/reports/users', checkAdmin, async (req, res) => {
  try {
    const filters = parseDateFilters(req);
    const format = pickFormat(req);
    const role = parseRole(req);
    const { clauses, params } = buildDateClause('qe', filters);
    const whereDate = clauses.length ? `AND ${clauses.join(' AND ')}` : '';
    // When the admin scoped the report to a date range, the report is asking
    // "who was active during this window?" — so suppress users with zero
    // matching entries via HAVING. With no filter, all users still appear so
    // the report doubles as a directory.
    const havingClause = clauses.length ? 'HAVING total_entries > 0' : '';
    // Role filter is a top-level WHERE on UserCredentials.
    const roleWhere = role ? 'WHERE uc.role = ?' : '';
    const roleParams = role ? [role] : [];

    const sql = `
      SELECT uc.user_id,
             COALESCE(up.full_name, '') AS full_name,
             uc.email,
             uc.role,
             COUNT(qe.entry_id) AS total_entries,
             SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS served,
             SUM(CASE WHEN qe.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
             SUM(CASE WHEN qe.status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
             MAX(qe.join_time) AS last_activity
      FROM UserCredentials uc
      LEFT JOIN UserProfile up ON uc.user_id = up.user_id
      LEFT JOIN QueueEntry qe ON qe.user_id = uc.user_id ${whereDate}
      ${roleWhere}
      GROUP BY uc.user_id, up.full_name, uc.email, uc.role
      ${havingClause}
      ORDER BY total_entries DESC, uc.user_id ASC
    `;
    // Param order: date params (in JOIN's ON clause) come BEFORE role params
    // (in the WHERE clause).
    const [rows] = await db.query(sql, [...params, ...roleParams]);

    const data = rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      role: r.role,
      totalEntries: Number(r.total_entries) || 0,
      served: Number(r.served) || 0,
      cancelled: Number(r.cancelled) || 0,
      waiting: Number(r.waiting) || 0,
      lastActivity: r.last_activity || null,
    }));

    if (format === 'csv') {
      const csv = toCsv(
        ['userId', 'fullName', 'email', 'role', 'totalEntries', 'served', 'cancelled', 'waiting', 'lastActivity'],
        data,
        ['User ID', 'Full Name', 'Email', 'Role', 'Total Entries', 'Served', 'Cancelled', 'Waiting', 'Last Activity']
      );
      return sendCsv(res, `users-report-${Date.now()}.csv`, csv);
    }

    return res.status(200).json({ filters, count: data.length, data });
  } catch (err) {
    console.error('users report error:', err);
    return res.status(500).json({ error: 'Failed to generate users report' });
  }
});

// ============================================================================
// GET /api/admin/reports/services
// One row per service with queue activity details.
// ============================================================================
router.get('/api/admin/reports/services', checkAdmin, async (req, res) => {
  try {
    const filters = parseDateFilters(req);
    const format = pickFormat(req);
    const { clauses, params } = buildDateClause('qe', filters);
    const whereDate = clauses.length ? `AND ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT s.service_id,
             s.name,
             s.description,
             s.expected_duration,
             s.priority,
             s.is_open,
             COUNT(qe.entry_id) AS total_entries,
             SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS served,
             SUM(CASE WHEN qe.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
             SUM(CASE WHEN qe.status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
             SUM(CASE WHEN qe.walk_in = 1 THEN 1 ELSE 0 END) AS walk_ins
      FROM Service s
      LEFT JOIN Queue q ON q.service_id = s.service_id
      LEFT JOIN QueueEntry qe ON qe.queue_id = q.queue_id ${whereDate}
      GROUP BY s.service_id, s.name, s.description, s.expected_duration, s.priority, s.is_open
      ORDER BY total_entries DESC, s.service_id ASC
    `;
    const [rows] = await db.query(sql, params);

    const data = rows.map((r) => ({
      serviceId: r.service_id,
      name: r.name,
      description: r.description,
      expectedDuration: r.expected_duration,
      priority: r.priority,
      isOpen: !!r.is_open,
      totalEntries: Number(r.total_entries) || 0,
      served: Number(r.served) || 0,
      cancelled: Number(r.cancelled) || 0,
      waiting: Number(r.waiting) || 0,
      walkIns: Number(r.walk_ins) || 0,
    }));

    if (format === 'csv') {
      const csv = toCsv(
        ['serviceId', 'name', 'description', 'expectedDuration', 'priority', 'isOpen',
         'totalEntries', 'served', 'cancelled', 'waiting', 'walkIns'],
        data,
        ['Service ID', 'Name', 'Description', 'Expected Duration (min)', 'Priority', 'Open',
         'Total Entries', 'Served', 'Cancelled', 'Waiting', 'Walk-ins']
      );
      return sendCsv(res, `services-report-${Date.now()}.csv`, csv);
    }

    return res.status(200).json({ filters, count: data.length, data });
  } catch (err) {
    console.error('services report error:', err);
    return res.status(500).json({ error: 'Failed to generate services report' });
  }
});

// ============================================================================
// GET /api/admin/reports/queue-stats
// Aggregate metrics: served count, cancelled count, average wait, etc.
// Optional ?serviceId=N to scope to a single service.
// ============================================================================
router.get('/api/admin/reports/queue-stats', checkAdmin, async (req, res) => {
  try {
    const filters = parseDateFilters(req);
    const format = pickFormat(req);
    const serviceIdRaw = req.query.serviceId;
    const serviceId = serviceIdRaw ? Number(serviceIdRaw) : null;
    if (serviceIdRaw && (!Number.isInteger(serviceId) || serviceId <= 0)) {
      return res.status(400).json({ error: 'serviceId must be a positive integer' });
    }
    const status = parseStatus(req);
    const priority = parsePriority(req);

    const { clauses, params } = buildDateClause('qe', filters);
    if (serviceId) {
      clauses.push('q.service_id = ?');
      params.push(serviceId);
    }
    if (status) {
      clauses.push('qe.status = ?');
      params.push(status);
    }
    if (priority) {
      clauses.push('qe.`priority` = ?');
      params.push(priority);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    // Run two separate queries — one for counts, one for the AVG of wait
    // minutes on currently-waiting entries. MySQL 9.x parser was unhappy with
    // mixing AVG(CASE WHEN ... THEN TIMESTAMPDIFF(...)) alongside the SUM(CASE)
    // aggregates in a single statement, so we split for portability.
    // We split the report into 3 small queries because MySQL 9.x rejects a
    // single SELECT that mixes many SUM(CASE ...) aggregates referencing the
    // `priority` column. Three simple queries are easier to debug anyway.
    //
    // 1) Status + walk-in counts
    const statusSql = `
      SELECT COUNT(qe.entry_id) AS total_entries,
             SUM(CASE WHEN qe.status = 'served' THEN 1 ELSE 0 END) AS served,
             SUM(CASE WHEN qe.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
             SUM(CASE WHEN qe.status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
             SUM(CASE WHEN qe.walk_in = 1 THEN 1 ELSE 0 END) AS walk_ins
      FROM QueueEntry qe
      JOIN Queue q ON qe.queue_id = q.queue_id
      ${where}
    `;
    const [[counts]] = await db.query(statusSql, params);

    // 2) Per-priority breakdown via GROUP BY. Returns 0–3 rows.
    const prioritySql = `
      SELECT qe.\`priority\` AS pri, COUNT(*) AS cnt
      FROM QueueEntry qe
      JOIN Queue q ON qe.queue_id = q.queue_id
      ${where}
      GROUP BY qe.\`priority\`
    `;
    const [priorityRows] = await db.query(prioritySql, params);
    const priCounts = { high: 0, medium: 0, low: 0 };
    priorityRows.forEach((r) => { if (r.pri in priCounts) priCounts[r.pri] = Number(r.cnt) || 0; });

    // 3a) "Avg wait so far" — promedio del tiempo que llevan esperando los que
    // SIGUEN en cola. Útil para entender el backlog actual.
    const waitParams = [...params];
    const waitWhereClauses = [...clauses, "qe.status = 'waiting'"];
    const waitWhere = `WHERE ${waitWhereClauses.join(' AND ')}`;
    const avgSoFarSql = `
      SELECT AVG(TIMESTAMPDIFF(MINUTE, qe.join_time, NOW())) AS avg_wait_so_far
      FROM QueueEntry qe
      JOIN Queue q ON qe.queue_id = q.queue_id
      ${waitWhere}
    `;
    const [[avgSoFarRow]] = await db.query(avgSoFarSql, waitParams);

    // 3b) "Avg wait time until served" — el verdadero KPI: cuánto tiempo
    // tardaron en ser atendidos los entries servidos. Sólo cuenta entries con
    // served_at no nulo (los servidos antes del migration tienen NULL).
    const servedParams = [...params];
    const servedWhereClauses = [...clauses, "qe.status = 'served'", 'qe.served_at IS NOT NULL'];
    const servedWhere = `WHERE ${servedWhereClauses.join(' AND ')}`;
    // Use SECOND-level resolution and divide so users that wait <1 minute
    // still register (instead of rounding to 0).
    const avgServedSql = `
      SELECT AVG(TIMESTAMPDIFF(SECOND, qe.join_time, qe.served_at)) / 60.0 AS avg_wait_until_served,
             COUNT(*) AS served_with_data
      FROM QueueEntry qe
      JOIN Queue q ON qe.queue_id = q.queue_id
      ${servedWhere}
    `;
    const [[avgServedRow]] = await db.query(avgServedSql, servedParams);

    const summary = {
      ...counts,
      high_priority: priCounts.high,
      medium_priority: priCounts.medium,
      low_priority: priCounts.low,
      avg_wait_so_far: avgSoFarRow?.avg_wait_so_far,
      avg_wait_until_served: avgServedRow?.avg_wait_until_served,
      served_with_data: avgServedRow?.served_with_data,
    };

    const totalEntries = Number(summary?.total_entries) || 0;
    const served = Number(summary?.served) || 0;
    const cancelled = Number(summary?.cancelled) || 0;
    const round1 = (v) => (v !== null && v !== undefined ? parseFloat(Number(v).toFixed(1)) : 0);
    const stats = {
      totalEntries,
      served,
      cancelled,
      waiting: Number(summary?.waiting) || 0,
      // Promedio que llevan esperando los que SIGUEN en cola.
      avgWaitSoFar: round1(summary?.avg_wait_so_far),
      // KPI real: cuánto esperaron los servidos hasta ser atendidos. Solo
      // cuenta los servidos después del schema migration con served_at.
      avgWaitUntilServed: round1(summary?.avg_wait_until_served),
      servedWithData: Number(summary?.served_with_data) || 0,
      highPriority: Number(summary?.high_priority) || 0,
      mediumPriority: Number(summary?.medium_priority) || 0,
      lowPriority: Number(summary?.low_priority) || 0,
      walkIns: Number(summary?.walk_ins) || 0,
      cancelRate: totalEntries > 0 ? parseFloat((cancelled / totalEntries * 100).toFixed(1)) : 0,
      serveRate: totalEntries > 0 ? parseFloat((served / totalEntries * 100).toFixed(1)) : 0,
    };

    if (format === 'csv') {
      // Single-row CSV — handy for dropping into a spreadsheet.
      const csv = toCsv(
        Object.keys(stats),
        [stats],
        ['Total Entries', 'Served', 'Cancelled', 'Waiting',
         'Avg Currently Waiting (min)', 'Avg Wait Until Served (min)', 'Served w/ Wait Data',
         'High Priority', 'Medium Priority', 'Low Priority', 'Walk-ins',
         'Cancel Rate (%)', 'Serve Rate (%)']
      );
      return sendCsv(res, `queue-stats-report-${Date.now()}.csv`, csv);
    }

    return res.status(200).json({ filters, serviceId: serviceId || null, stats });
  } catch (err) {
    console.error('queue-stats report error:', err);
    return res.status(500).json({ error: 'Failed to generate queue stats report' });
  }
});

// ============================================================================
// GET /api/admin/reports/user-history?userId=N
// Detailed history rows for one user (or all users if userId omitted).
// ============================================================================
router.get('/api/admin/reports/user-history', checkAdmin, async (req, res) => {
  try {
    const filters = parseDateFilters(req);
    const format = pickFormat(req);
    const userIdRaw = req.query.userId;
    const userId = userIdRaw ? Number(userIdRaw) : null;
    if (userIdRaw && (!Number.isInteger(userId) || userId <= 0)) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }
    const status = parseStatus(req);
    const priority = parsePriority(req);
    const walkIn = parseWalkIn(req);

    const { clauses, params } = buildDateClause('qe', filters);
    if (userId) {
      clauses.push('qe.user_id = ?');
      params.push(userId);
    }
    if (status) {
      clauses.push('qe.status = ?');
      params.push(status);
    }
    if (priority) {
      clauses.push('qe.`priority` = ?');
      params.push(priority);
    }
    if (walkIn !== null) {
      clauses.push('qe.walk_in = ?');
      params.push(walkIn);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT qe.entry_id,
             qe.user_id,
             qe.user_name,
             s.service_id,
             s.name AS service_name,
             qe.priority,
             qe.status,
             qe.walk_in,
             qe.join_time,
             qe.position
      FROM QueueEntry qe
      JOIN Queue q ON qe.queue_id = q.queue_id
      JOIN Service s ON q.service_id = s.service_id
      ${where}
      ORDER BY qe.join_time DESC
    `;
    const [rows] = await db.query(sql, params);

    const data = rows.map((r) => ({
      entryId: r.entry_id,
      userId: r.user_id,
      userName: r.user_name,
      serviceId: r.service_id,
      serviceName: r.service_name,
      priority: r.priority,
      status: r.status,
      walkIn: !!r.walk_in,
      joinedAt: r.join_time,
      position: r.position,
    }));

    if (format === 'csv') {
      const csv = toCsv(
        ['entryId', 'userId', 'userName', 'serviceId', 'serviceName', 'priority', 'status', 'walkIn', 'joinedAt', 'position'],
        data,
        ['Entry ID', 'User ID', 'User Name', 'Service ID', 'Service', 'Priority', 'Status', 'Walk-in', 'Joined At', 'Position']
      );
      return sendCsv(res, `user-history-${Date.now()}.csv`, csv);
    }

    return res.status(200).json({ filters, userId: userId || null, count: data.length, data });
  } catch (err) {
    console.error('user-history report error:', err);
    return res.status(500).json({ error: 'Failed to generate user history report' });
  }
});

module.exports = router;
