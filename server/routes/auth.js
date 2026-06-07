const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vendorbridge_default_secret';

// Helper: log activity
async function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  await db.run(`
    INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `, userId, userName, action, entityType, entityId, details);
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const db = getDB();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const validRoles = ['admin', 'procurement_officer', 'vendor', 'manager'];
    const userRole = validRoles.includes(role) ? role : 'procurement_officer';

    const passwordHash = bcrypt.hashSync(password, 10);

    const result = await db.run(`
      INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
    `, name, email, passwordHash, userRole);

    // If registering as vendor, create vendor record
    if (userRole === 'vendor') {
      await db.run(`
        INSERT INTO vendors (user_id, company_name, contact_person, email, status)
        VALUES (?, ?, ?, ?, 'pending')
      `, result.lastInsertRowid, name, name, email);
    }

    const token = jwt.sign(
      { id: result.lastInsertRowid, name, email, role: userRole },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(result.lastInsertRowid, name, 'user_registered', 'user', result.lastInsertRowid, `New ${userRole} registered`);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.lastInsertRowid, name, email, role: userRole }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDB();
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);

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

    await logActivity(user.id, user.name, 'user_login', 'user', user.id, 'User logged in');

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getDB();
    const user = await db.get('SELECT id FROM users WHERE email = ?', email);

    // Always return success to prevent email enumeration
    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const user = await db.get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users (admin only)
router.get('/users', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const db = getDB();
    const users = await db.all('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/users/:id (admin only)
router.put('/users/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, role, is_active } = req.body;
    const db = getDB();

    const user = await db.get('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.run(`
      UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role),
      is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, name, role, is_active, req.params.id);

    res.json({ message: 'User updated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile (update logged-in user's profile/password)
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, current_password, new_password } = req.body;
    const db = getDB();

    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let passwordHash = user.password_hash;
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      const valid = bcrypt.compareSync(current_password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Incorrect current password' });
      }
      passwordHash = bcrypt.hashSync(new_password, 10);
    }

    const updatedName = name || user.name;

    await db.run(`
      UPDATE users SET name = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, updatedName, passwordHash, req.user.id);

    if (user.role === 'vendor' && name) {
      await db.run(`
        UPDATE vendors SET company_name = COALESCE(?, company_name), contact_person = COALESCE(?, contact_person)
        WHERE user_id = ?
      `, name, name, req.user.id);
    }

    await logActivity(req.user.id, updatedName, 'profile_updated', 'user', req.user.id, 'Updated profile settings');

    res.json({
      message: 'Profile updated successfully',
      user: { id: user.id, name: updatedName, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
