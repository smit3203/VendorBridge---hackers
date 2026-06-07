const express = require('express');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

async function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`, userId, userName, action, entityType, entityId, details);
}

function generateQuoteNumber() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `QT-${datePart}-${rand}`;
}

// GET /api/quotations
router.get('/', authenticate, async (req, res, next) => {
  try {
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

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM quotations q WHERE ${where.join(' AND ')}`, ...params);
    const total = totalRow ? parseInt(totalRow.count || 0) : 0;

    const quotations = await db.all(`
      SELECT q.*, v.company_name as vendor_name, r.title as rfq_title, r.rfq_number
      FROM quotations q
      JOIN vendors v ON q.vendor_id = v.id
      JOIN rfqs r ON q.rfq_id = r.id
      WHERE ${where.join(' AND ')}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(limit), parseInt(offset));

    for (const q of quotations) {
      q.items = await db.all(`
        SELECT qi.*, ri.product_name, ri.quantity as rfq_quantity, ri.unit
        FROM quotation_items qi
        JOIN rfq_items ri ON qi.rfq_item_id = ri.id
        WHERE qi.quotation_id = ?
      `, q.id);
    }

    res.json({ quotations, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/quotations/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const quotation = await db.get(`
      SELECT q.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
             r.title as rfq_title, r.rfq_number, r.deadline
      FROM quotations q
      JOIN vendors v ON q.vendor_id = v.id
      JOIN rfqs r ON q.rfq_id = r.id
      WHERE q.id = ?
    `, req.params.id);

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    quotation.items = await db.all(`
      SELECT qi.*, ri.product_name, ri.description as item_description, ri.quantity as rfq_quantity, ri.unit
      FROM quotation_items qi
      JOIN rfq_items ri ON qi.rfq_item_id = ri.id
      WHERE qi.quotation_id = ?
    `, quotation.id);

    res.json({ quotation });
  } catch (err) {
    next(err);
  }
});

// POST /api/quotations
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { rfq_id, vendor_id, delivery_timeline, notes, items } = req.body;
    const db = getDB();

    // Determine vendor_id: use provided or get from user's vendor record
    let actualVendorId = vendor_id;
    if (req.user.role === 'vendor' && !vendor_id) {
      const vendor = await db.get('SELECT id FROM vendors WHERE user_id = ?', req.user.id);
      if (!vendor) return res.status(400).json({ error: 'Vendor profile not found' });
      actualVendorId = vendor.id;
    }

    if (!rfq_id || !actualVendorId) {
      return res.status(400).json({ error: 'RFQ and vendor are required' });
    }

    // Check RFQ is open
    const rfq = await db.get('SELECT * FROM rfqs WHERE id = ? AND status = ?', rfq_id, 'open');
    if (!rfq) return res.status(400).json({ error: 'RFQ is not open for quotations' });

    // Check vendor is invited
    const invited = await db.get('SELECT * FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', rfq_id, actualVendorId);
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

    const result = await db.run(`
      INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, quotationNumber, rfq_id, actualVendorId, totalAmount, delivery_timeline, notes);

    const quotationId = result.lastInsertRowid;

    if (items && items.length > 0) {
      for (const item of items) {
        const rfqItem = await db.get('SELECT quantity FROM rfq_items WHERE id = ?', item.rfq_item_id);
        const qty = rfqItem ? rfqItem.quantity : 1;
        const totalPrice = item.unit_price * qty;
        await db.run(`
          INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes)
          VALUES (?, ?, ?, ?, ?)
        `, quotationId, item.rfq_item_id, item.unit_price, totalPrice, item.notes);
      }
    }

    await logActivity(req.user.id, req.user.name, 'quotation_submitted', 'quotation', quotationId, `Quotation ${quotationNumber} submitted for RFQ`);

    res.status(201).json({ message: 'Quotation submitted', id: quotationId, quotation_number: quotationNumber });
  } catch (err) {
    next(err);
  }
});

// PUT /api/quotations/:id
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { delivery_timeline, notes, items, status } = req.body;
    const db = getDB();
    const quotationId = req.params.id;

    const quotation = await db.get('SELECT * FROM quotations WHERE id = ?', quotationId);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    // Vendors can only edit their own submitted quotations
    if (req.user.role === 'vendor') {
      const vendor = await db.get('SELECT id FROM vendors WHERE user_id = ?', req.user.id);
      if (!vendor || vendor.id !== quotation.vendor_id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (quotation.status !== 'submitted') {
        return res.status(400).json({ error: 'Can only edit submitted quotations' });
      }
    }

    let totalAmount = quotation.total_amount;
    if (items && items.length > 0) {
      await db.run('DELETE FROM quotation_items WHERE quotation_id = ?', quotationId);
      totalAmount = 0;
      for (const item of items) {
        const rfqItem = await db.get('SELECT quantity FROM rfq_items WHERE id = ?', item.rfq_item_id);
        const qty = rfqItem ? rfqItem.quantity : 1;
        const totalPrice = item.unit_price * qty;
        totalAmount += totalPrice;
        await db.run(`
          INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes)
          VALUES (?, ?, ?, ?, ?)
        `, quotationId, item.rfq_item_id, item.unit_price, totalPrice, item.notes);
      }
    }

    await db.run(`
      UPDATE quotations SET
        total_amount = ?,
        delivery_timeline = COALESCE(?, delivery_timeline),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, totalAmount, delivery_timeline, notes, status, quotationId);

    await logActivity(req.user.id, req.user.name, 'quotation_updated', 'quotation', quotationId, `Quotation ${quotation.quotation_number} updated`);

    res.json({ message: 'Quotation updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
