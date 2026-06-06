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

function generateRFQNumber() {
  const date = new Date();
  const prefix = 'RFQ';
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${datePart}-${rand}`;
}

// GET /api/rfqs
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  // Vendors only see RFQs they are invited to
  if (req.user.role === 'vendor') {
    where.push('rv.vendor_id = (SELECT id FROM vendors WHERE user_id = ?)');
    params.push(req.user.id);
  }

  if (status) { where.push('r.status = ?'); params.push(status); }
  if (search) {
    where.push('(r.title LIKE ? OR r.rfq_number LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const joinClause = req.user.role === 'vendor' ? 'LEFT JOIN rfq_vendors rv ON r.id = rv.rfq_id' : '';

  const total = db.prepare(`SELECT COUNT(DISTINCT r.id) as count FROM rfqs r ${joinClause} WHERE ${where.join(' AND ')}`).get(...params).count;

  const rfqs = db.prepare(`
    SELECT DISTINCT r.*, u.name as created_by_name,
      (SELECT COUNT(*) FROM quotations WHERE rfq_id = r.id) as quotation_count
    FROM rfqs r
    LEFT JOIN users u ON r.created_by = u.id
    ${joinClause}
    WHERE ${where.join(' AND ')}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  // Get items and assigned vendors for each RFQ
  rfqs.forEach(rfq => {
    rfq.items = db.prepare('SELECT * FROM rfq_items WHERE rfq_id = ?').all(rfq.id);
    rfq.vendors = db.prepare(`
      SELECT v.id, v.company_name, rv.invited_at
      FROM rfq_vendors rv JOIN vendors v ON rv.vendor_id = v.id
      WHERE rv.rfq_id = ?
    `).all(rfq.id);
  });

  res.json({ rfqs, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/rfqs/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDB();
  const rfq = db.prepare(`
    SELECT r.*, u.name as created_by_name FROM rfqs r
    LEFT JOIN users u ON r.created_by = u.id WHERE r.id = ?
  `).get(req.params.id);

  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

  rfq.items = db.prepare('SELECT * FROM rfq_items WHERE rfq_id = ?').all(rfq.id);
  rfq.vendors = db.prepare(`
    SELECT v.id, v.company_name, v.contact_person, v.email, rv.invited_at
    FROM rfq_vendors rv JOIN vendors v ON rv.vendor_id = v.id
    WHERE rv.rfq_id = ?
  `).all(rfq.id);
  rfq.quotations = db.prepare(`
    SELECT q.*, v.company_name as vendor_name FROM quotations q
    JOIN vendors v ON q.vendor_id = v.id WHERE q.rfq_id = ?
  `).all(rfq.id);

  res.json({ rfq });
});

// POST /api/rfqs
router.post('/', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const { title, description, deadline, items, vendor_ids, status } = req.body;

  if (!title) return res.status(400).json({ error: 'RFQ title is required' });

  const db = getDB();
  const rfqNumber = generateRFQNumber();
  const rfqStatus = status || 'draft';

  const result = db.prepare(`
    INSERT INTO rfqs (rfq_number, title, description, created_by, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(rfqNumber, title, description, req.user.id, deadline, rfqStatus);

  const rfqId = result.lastInsertRowid;

  // Insert items
  if (items && items.length > 0) {
    const insertItem = db.prepare(`
      INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit)
      VALUES (?, ?, ?, ?, ?)
    `);
    items.forEach(item => {
      insertItem.run(rfqId, item.product_name, item.description, item.quantity, item.unit || 'pcs');
    });
  }

  // Assign vendors
  if (vendor_ids && vendor_ids.length > 0) {
    const insertVendor = db.prepare('INSERT OR IGNORE INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?)');
    vendor_ids.forEach(vid => {
      insertVendor.run(rfqId, vid);
    });
  }

  logActivity(req.user.id, req.user.name, 'rfq_created', 'rfq', rfqId, `RFQ "${rfqNumber}" created: ${title}`);

  res.status(201).json({ message: 'RFQ created', id: rfqId, rfq_number: rfqNumber });
});

// PUT /api/rfqs/:id
router.put('/:id', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const { title, description, deadline, items, vendor_ids, status } = req.body;
  const db = getDB();
  const rfqId = req.params.id;

  const rfq = db.prepare('SELECT * FROM rfqs WHERE id = ?').get(rfqId);
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

  db.prepare(`
    UPDATE rfqs SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      deadline = COALESCE(?, deadline),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, deadline, status, rfqId);

  // Replace items if provided
  if (items) {
    db.prepare('DELETE FROM rfq_items WHERE rfq_id = ?').run(rfqId);
    const insertItem = db.prepare(`
      INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit)
      VALUES (?, ?, ?, ?, ?)
    `);
    items.forEach(item => {
      insertItem.run(rfqId, item.product_name, item.description, item.quantity, item.unit || 'pcs');
    });
  }

  // Replace vendor assignments if provided
  if (vendor_ids) {
    db.prepare('DELETE FROM rfq_vendors WHERE rfq_id = ?').run(rfqId);
    const insertVendor = db.prepare('INSERT OR IGNORE INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?)');
    vendor_ids.forEach(vid => {
      insertVendor.run(rfqId, vid);
    });
  }

  logActivity(req.user.id, req.user.name, 'rfq_updated', 'rfq', rfqId, `RFQ "${rfq.rfq_number}" updated`);

  res.json({ message: 'RFQ updated' });
});

// DELETE /api/rfqs/:id
router.delete('/:id', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const db = getDB();
  const rfq = db.prepare('SELECT * FROM rfqs WHERE id = ?').get(req.params.id);
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

  db.prepare('DELETE FROM rfqs WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, req.user.name, 'rfq_deleted', 'rfq', req.params.id, `RFQ "${rfq.rfq_number}" deleted`);

  res.json({ message: 'RFQ deleted' });
});

module.exports = router;
