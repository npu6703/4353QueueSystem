const bcrypt = require('bcrypt');

let users = [
  {
    id: 1,
    name: "Admin",
    email: "admin@queuesmart.com",
    password: "$2b$10$8wJ1yQ0nqU0KcP0G7R7W7u4D6b9V2hPqv5Qm4dH2V1A5n0mCj2G7K",
    role: "admin"
  }
];

// REGISTER
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof role !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid input types"
    });
  }

  if (name.trim().length < 2 || name.trim().length > 50) {
    return res.status(400).json({
      success: false,
      message: "Name must be between 2 and 50 characters"
    });
  }

  if (email.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Email must not exceed 100 characters"
    });
  }

  if (password.length < 6 || password.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Password must be between 6 and 50 characters"
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  if (role !== "user" && role !== "admin") {
    return res.status(400).json({
      success: false,
      message: "Role must be user or admin"
    });
  }

  const existingUser = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already exists"
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: users.length + 1,
    name: name.trim(),
    email: email.trim(),
    password: hashedPassword,
    role
  };

  users.push(newUser);

  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
};

// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Invalid input types"
    });
  }

  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  const isMatch = user && await bcrypt.compare(password, user.password);

  if (!user || !isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  }

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};

module.exports = { register, login };