const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vendorbridge_default_secret';

// Helper: log activity
function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, action, entityType, entityId, details);
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const db = getDB();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const validRoles = ['admin', 'procurement_officer', 'vendor', 'manager'];
  const userRole = validRoles.includes(role) ? role : 'procurement_officer';

  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
  `).run(name, email, passwordHash, userRole);

  // If registering as vendor, create vendor record
  if (userRole === 'vendor') {
    db.prepare(`
      INSERT INTO vendors (user_id, company_name, contact_person, email, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(result.lastInsertRowid, name, name, email);
  }

  const token = jwt.sign(
    { id: result.lastInsertRowid, name, email, role: userRole },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logActivity(result.lastInsertRowid, name, 'user_registered', 'user', result.lastInsertRowid, `New ${userRole} registered`);

  res.status(201).json({
    message: 'Registration successful',
    token,
    user: { id: result.lastInsertRowid, name, email, role: userRole }
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logActivity(user.id, user.name, 'user_login', 'user', user.id, 'User logged in');

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const db = getDB();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  // Always return success to prevent email enumeration
  res.json({ message: 'If the email exists, a password reset link has been sent.' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// GET /api/auth/users (admin only)
router.get('/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const db = getDB();
  const users = db.prepare('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { name, role, is_active } = req.body;
  const db = getDB();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role),
    is_active = COALESCE(?, is_active), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, role, is_active, req.params.id);

  res.json({ message: 'User updated' });
});

module.exports = router;
