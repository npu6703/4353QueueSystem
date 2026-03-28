const store = require('../store');

// REGISTER
const register = async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (typeof name !== 'string' || typeof email !== 'string' ||
      typeof password !== 'string' || typeof role !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid input types' });
  }

  if (name.trim().length < 2 || name.trim().length > 50) {
    return res.status(400).json({ success: false, message: 'Name must be between 2 and 50 characters' });
  }

  if (email.length > 100) {
    return res.status(400).json({ success: false, message: 'Email must not exceed 100 characters' });
  }

  if (password.length < 4 || password.length > 50) {
    return res.status(400).json({ success: false, message: 'Password must be between 4 and 50 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ success: false, message: 'Role must be user or admin' });
  }

  const existing = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already exists' });
  }

  const newUser = {
    id: 'u' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    phone: phone || '',
    isAdmin: role === 'admin',
  };

  store.users.push(newUser);

  return res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { id: newUser.id, name: newUser.name, email: newUser.email, role },
  });
};

// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid input types' });
  }

  const user = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      isAdmin: user.isAdmin,
      role: user.isAdmin ? 'admin' : 'user',
    },
  });
};

module.exports = { register, login };
