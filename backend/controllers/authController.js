const pool = require('../db');
const bcrypt = require('bcrypt');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// REGISTER
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      (phone !== undefined && typeof phone !== 'string')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input types'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    // Role is NOT taken from the request body. Self-registration always
    // creates a regular user; admins must be promoted directly in the database
    // (or via a future admin-only endpoint) to prevent privilege escalation.
    const cleanRole = 'user';
    const cleanPhone = phone ? phone.trim() : '';

    if (cleanName.length < 2 || cleanName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 50 characters'
      });
    }

    if (cleanEmail.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Email must not exceed 100 characters'
      });
    }

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < 4 || password.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Password must be between 4 and 50 characters'
      });
    }

    const [existing] = await pool.execute(
      'SELECT user_id FROM UserCredentials WHERE email = ?',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [credResult] = await pool.execute(
      `INSERT INTO UserCredentials (email, password, role)
       VALUES (?, ?, ?)`,
      [cleanEmail, hashedPassword, cleanRole]
    );

    const userId = credResult.insertId;

    await pool.execute(
      `INSERT INTO UserProfile (user_id, full_name, email, phone, preferences)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, cleanName, cleanEmail, cleanPhone, null]
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: cleanRole
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input types'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const [rows] = await pool.execute(
      `SELECT uc.user_id, uc.email, uc.password, uc.role, up.full_name, up.phone
       FROM UserCredentials uc
       LEFT JOIN UserProfile up ON uc.user_id = up.user_id
       WHERE uc.email = ?`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user.user_id,
        name: user.full_name || '',
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
        success: false,
        message: 'Server error during login'
    });
  }
};

module.exports = { register, login };