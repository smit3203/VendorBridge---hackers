const express = require('express');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  db.prepare(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, userName, action, entityType, entityId, details);
}

function generateQuoteNumber() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `QT-${datePart}-${rand}`;
}

// GET /api/quotations
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const { rfq_id, vendor_id, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (req.user.role === 'vendor') {
    where.push('q.vendor_id = (SELECT id FROM vendors WHERE user_id = ?)');
    params.push(req.user.id);
  }
  if (rfq_id) { where.push('q.rfq_id = ?'); params.push(rfq_id); }
  if (vendor_id) { where.push('q.vendor_id = ?'); params.push(vendor_id); }
  if (status) { where.push('q.status = ?'); params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM quotations q WHERE ${where.join(' AND ')}`).get(...params).count;

  const quotations = db.prepare(`
    SELECT q.*, v.company_name as vendor_name, r.title as rfq_title, r.rfq_number
    FROM quotations q
    JOIN vendors v ON q.vendor_id = v.id
    JOIN rfqs r ON q.rfq_id = r.id
    WHERE ${where.join(' AND ')}
    ORDER BY q.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  quotations.forEach(q => {
    q.items = db.prepare(`
      SELECT qi.*, ri.product_name, ri.quantity as rfq_quantity, ri.unit
      FROM quotation_items qi
      JOIN rfq_items ri ON qi.rfq_item_id = ri.id
      WHERE qi.quotation_id = ?
    `).all(q.id);
  });

  res.json({ quotations, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/quotations/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDB();
  const quotation = db.prepare(`
    SELECT q.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
           r.title as rfq_title, r.rfq_number, r.deadline
    FROM quotations q
    JOIN vendors v ON q.vendor_id = v.id
    JOIN rfqs r ON q.rfq_id = r.id
    WHERE q.id = ?
  `).get(req.params.id);

  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  quotation.items = db.prepare(`
    SELECT qi.*, ri.product_name, ri.description as item_description, ri.quantity as rfq_quantity, ri.unit
    FROM quotation_items qi
    JOIN rfq_items ri ON qi.rfq_item_id = ri.id
    WHERE qi.quotation_id = ?
  `).all(quotation.id);

  res.json({ quotation });
});

// POST /api/quotations
router.post('/', authenticate, (req, res) => {
  const { rfq_id, vendor_id, delivery_timeline, notes, items } = req.body;
  const db = getDB();

  // Determine vendor_id: use provided or get from user's vendor record
  let actualVendorId = vendor_id;
  if (req.user.role === 'vendor' && !vendor_id) {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id);
    if (!vendor) return res.status(400).json({ error: 'Vendor profile not found' });
    actualVendorId = vendor.id;
  }

  if (!rfq_id || !actualVendorId) {
    return res.status(400).json({ error: 'RFQ and vendor are required' });
  }

  // Check RFQ is open
  const rfq = db.prepare('SELECT * FROM rfqs WHERE id = ? AND status = ?').get(rfq_id, 'open');
  if (!rfq) return res.status(400).json({ error: 'RFQ is not open for quotations' });

  // Check vendor is invited
  const invited = db.prepare('SELECT * FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?').get(rfq_id, actualVendorId);
  if (!invited && req.user.role === 'vendor') {
    return res.status(403).json({ error: 'You are not invited to this RFQ' });
  }

  // Calculate total
  let totalAmount = 0;
  if (items && items.length > 0) {
    items.forEach(item => {
      totalAmount += item.unit_price * (item.rfq_quantity || item.quantity || 1);
    });
  }

  const quotationNumber = generateQuoteNumber();

  const result = db.prepare(`
    INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(quotationNumber, rfq_id, actualVendorId, totalAmount, delivery_timeline, notes);

  const quotationId = result.lastInsertRowid;

  if (items && items.length > 0) {
    const insertItem = db.prepare(`
      INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    items.forEach(item => {
      const rfqItem = db.prepare('SELECT quantity FROM rfq_items WHERE id = ?').get(item.rfq_item_id);
      const qty = rfqItem ? rfqItem.quantity : 1;
      const totalPrice = item.unit_price * qty;
      insertItem.run(quotationId, item.rfq_item_id, item.unit_price, totalPrice, item.notes);
    });
  }

  logActivity(req.user.id, req.user.name, 'quotation_submitted', 'quotation', quotationId, `Quotation ${quotationNumber} submitted for RFQ`);

  res.status(201).json({ message: 'Quotation submitted', id: quotationId, quotation_number: quotationNumber });
});

// PUT /api/quotations/:id
router.put('/:id', authenticate, (req, res) => {
  const { delivery_timeline, notes, items, status } = req.body;
  const db = getDB();
  const quotationId = req.params.id;

  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  // Vendors can only edit their own submitted quotations
  if (req.user.role === 'vendor') {
    const vendor = db.prepare('SELECT id FROM vendors WHERE user_id = ?').get(req.user.id);
    if (!vendor || vendor.id !== quotation.vendor_id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (quotation.status !== 'submitted') {
      return res.status(400).json({ error: 'Can only edit submitted quotations' });
    }
  }

  let totalAmount = quotation.total_amount;
  if (items && items.length > 0) {
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quotationId);
    totalAmount = 0;
    const insertItem = db.prepare(`
      INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    items.forEach(item => {
      const rfqItem = db.prepare('SELECT quantity FROM rfq_items WHERE id = ?').get(item.rfq_item_id);
      const qty = rfqItem ? rfqItem.quantity : 1;
      const totalPrice = item.unit_price * qty;
      totalAmount += totalPrice;
      insertItem.run(quotationId, item.rfq_item_id, item.unit_price, totalPrice, item.notes);
    });
  }

  db.prepare(`
    UPDATE quotations SET
      total_amount = ?,
      delivery_timeline = COALESCE(?, delivery_timeline),
      notes = COALESCE(?, notes),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(totalAmount, delivery_timeline, notes, status, quotationId);

  logActivity(req.user.id, req.user.name, 'quotation_updated', 'quotation', quotationId, `Quotation ${quotation.quotation_number} updated`);

  res.json({ message: 'Quotation updated' });
});

module.exports = router;
