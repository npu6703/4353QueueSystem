function checkAdmin(req, res, next) {
  if (req.headers['role'] === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: admin access required' });
}

module.exports = { checkAdmin };
