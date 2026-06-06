const express = require('express');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, action, entityType, entityId, details);
}

// GET /api/vendors
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const { status, category, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (status) { where.push('v.status = ?'); params.push(status); }
  if (category) { where.push('v.category = ?'); params.push(category); }
  if (search) {
    where.push('(v.company_name LIKE ? OR v.contact_person LIKE ? OR v.email LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM vendors v WHERE ${where.join(' AND ')}`).get(...params).count;

  const vendors = db.prepare(`
    SELECT v.*, u.name as user_name
    FROM vendors v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY v.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({ vendors, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/vendors/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDB();
  const vendor = db.prepare(`
    SELECT v.*, u.name as user_name FROM vendors v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.id = ?
  `).get(req.params.id);

  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  res.json({ vendor });
});

// POST /api/vendors
router.post('/', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const { company_name, contact_person, email, phone, address, gst_number, category, status } = req.body;

  if (!company_name || !contact_person || !email) {
    return res.status(400).json({ error: 'Company name, contact person, and email are required' });
  }

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO vendors (company_name, contact_person, email, phone, address, gst_number, category, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company_name, contact_person, email, phone, address, gst_number, category, status || 'active');

  logActivity(req.user.id, req.user.name, 'vendor_created', 'vendor', result.lastInsertRowid, `Vendor "${company_name}" created`);

  res.status(201).json({ message: 'Vendor created', id: result.lastInsertRowid });
});

// PUT /api/vendors/:id
router.put('/:id', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const { company_name, contact_person, email, phone, address, gst_number, category, status, rating } = req.body;
  const db = getDB();

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  db.prepare(`
    UPDATE vendors SET
      company_name = COALESCE(?, company_name),
      contact_person = COALESCE(?, contact_person),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      gst_number = COALESCE(?, gst_number),
      category = COALESCE(?, category),
      status = COALESCE(?, status),
      rating = COALESCE(?, rating),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(company_name, contact_person, email, phone, address, gst_number, category, status, rating, req.params.id);

  logActivity(req.user.id, req.user.name, 'vendor_updated', 'vendor', req.params.id, `Vendor "${vendor.company_name}" updated`);

  res.json({ message: 'Vendor updated' });
});

// DELETE /api/vendors/:id
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDB();
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, req.user.name, 'vendor_deleted', 'vendor', req.params.id, `Vendor "${vendor.company_name}" deleted`);

  res.json({ message: 'Vendor deleted' });
});

// GET /api/vendors/categories/list
router.get('/categories/list', authenticate, (req, res) => {
  const db = getDB();
  const categories = db.prepare("SELECT DISTINCT category FROM vendors WHERE category IS NOT NULL AND category != ''").all();
  res.json({ categories: categories.map(c => c.category) });
});

module.exports = router;
