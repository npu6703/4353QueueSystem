const db = require('../db');

// Insert a notification row addressed to every admin user. Failures are
// logged but never thrown — admin notifications are best-effort and must
// not break the request that triggered them.
async function notifyAdmins(message) {
  try {
    const [admins] = await db.query(
      "SELECT user_id FROM UserCredentials WHERE role = 'admin'"
    );
    if (admins.length === 0) return;
    for (const admin of admins) {
      try {
        await db.query(
          "INSERT INTO Notification (user_id, message, status) VALUES (?, ?, 'sent')",
          [admin.user_id, message]
        );
      } catch (innerErr) {
        console.error('Failed to insert admin notification for user', admin.user_id, innerErr);
      }
    }
  } catch (err) {
    console.error('Failed to fetch admins for notification:', err);
  }
}

module.exports = { notifyAdmins };
