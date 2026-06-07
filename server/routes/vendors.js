const express = require('express');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

async function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  await db.run(`
    INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `, userId, userName, action, entityType, entityId, details);
}

// GET /api/vendors
router.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    let params = [];

    if (status) { where.push('v.status = ?'); params.push(status); }
    if (category) { where.push('v.category = ?'); params.push(category); }
    if (search) {
      const likeOp = db.isPostgres ? 'ILIKE' : 'LIKE';
      where.push(`(v.company_name ${likeOp} ? OR v.contact_person ${likeOp} ? OR v.email ${likeOp} ?)`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM vendors v WHERE ${where.join(' AND ')}`, ...params);
    const total = totalRow ? parseInt(totalRow.count || 0) : 0;

    const vendors = await db.all(`
      SELECT v.*, u.name as user_name
      FROM vendors v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(limit), parseInt(offset));

    res.json({ vendors, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const vendor = await db.get(`
      SELECT v.*, u.name as user_name FROM vendors v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.id = ?
    `, req.params.id);

    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
});

// POST /api/vendors
router.post('/', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { company_name, contact_person, email, phone, address, gst_number, category, status } = req.body;

    if (!company_name || !contact_person || !email) {
      return res.status(400).json({ error: 'Company name, contact person, and email are required' });
    }

    const db = getDB();
    const result = await db.run(`
      INSERT INTO vendors (company_name, contact_person, email, phone, address, gst_number, category, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, company_name, contact_person, email, phone, address, gst_number, category, status || 'active');

    await logActivity(req.user.id, req.user.name, 'vendor_created', 'vendor', result.lastInsertRowid, `Vendor "${company_name}" created`);

    res.status(201).json({ message: 'Vendor created', id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// PUT /api/vendors/:id
router.put('/:id', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { company_name, contact_person, email, phone, address, gst_number, category, status, rating } = req.body;
    const db = getDB();

    const vendor = await db.get('SELECT * FROM vendors WHERE id = ?', req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    await db.run(`
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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, company_name, contact_person, email, phone, address, gst_number, category, status, rating, req.params.id);

    await logActivity(req.user.id, req.user.name, 'vendor_updated', 'vendor', req.params.id, `Vendor "${vendor.company_name}" updated`);

    res.json({ message: 'Vendor updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/vendors/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const db = getDB();
    const vendor = await db.get('SELECT * FROM vendors WHERE id = ?', req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    await db.run('DELETE FROM vendors WHERE id = ?', req.params.id);
    await logActivity(req.user.id, req.user.name, 'vendor_deleted', 'vendor', req.params.id, `Vendor "${vendor.company_name}" deleted`);

    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/vendors/categories/list
router.get('/categories/list', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const categories = await db.all("SELECT DISTINCT category FROM vendors WHERE category IS NOT NULL AND category != ''");
    res.json({ categories: categories.map(c => c.category) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
