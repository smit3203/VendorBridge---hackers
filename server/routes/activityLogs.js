const express = require('express');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity-logs
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const { entity_type, entity_id, user_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (entity_type) { where.push('entity_type = ?'); params.push(entity_type); }
  if (entity_id) { where.push('entity_id = ?'); params.push(entity_id); }
  if (user_id) { where.push('user_id = ?'); params.push(user_id); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM activity_logs WHERE ${where.join(' AND ')}`).get(...params).count;

  const logs = db.prepare(`
    SELECT * FROM activity_logs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = router;
