const db = require('../db');

// Verifies the requester is a real admin by looking up the `user-id` header
// against UserCredentials. The previous implementation trusted a client-supplied
// `role` header, which let any caller add `role: admin` to bypass protection.
async function checkAdmin(req, res, next) {
  try {
    const rawId = req.headers['user-id'];
    const userId = Number(rawId);
    if (!rawId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Unauthorized: missing user identity' });
    }

    const [rows] = await db.query(
      'SELECT role FROM UserCredentials WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0 || rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
    }

    req.user = { id: userId, role: rows[0].role };
    return next();
  } catch (err) {
    console.error('checkAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Auth check failed' });
  }
}

module.exports = { checkAdmin };
