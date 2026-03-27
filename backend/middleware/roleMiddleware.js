const checkAdmin = (req, res, next) => {
  const role = req.headers.role;

  if (!role || role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: admin only'
    });
  }

  next();
};

module.exports = { checkAdmin };