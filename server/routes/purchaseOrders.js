const express = require('express');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

async function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`, userId, userName, action, entityType, entityId, details);
}

function generatePONumber() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${datePart}-${rand}`;
}

// GET /api/purchase-orders
router.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'vendor') {
      where.push('po.vendor_id = (SELECT id FROM vendors WHERE user_id = ?)');
      params.push(req.user.id);
    }
    if (status) { where.push('po.status = ?'); params.push(status); }
    if (search) {
      const likeOp = db.isPostgres ? 'ILIKE' : 'LIKE';
      where.push(`(po.po_number ${likeOp} ? OR v.company_name ${likeOp} ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM purchase_orders po JOIN vendors v ON po.vendor_id = v.id WHERE ${where.join(' AND ')}`, ...params);
    const total = totalRow ? parseInt(totalRow.count || 0) : 0;

    const purchaseOrders = await db.all(`
      SELECT po.*, v.company_name as vendor_name, r.rfq_number, r.title as rfq_title,
             u.name as created_by_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      JOIN rfqs r ON po.rfq_id = r.id
      JOIN users u ON po.created_by = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(limit), parseInt(offset));

    for (const po of purchaseOrders) {
      po.items = await db.all('SELECT * FROM po_items WHERE po_id = ?', po.id);
    }

    res.json({ purchaseOrders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/purchase-orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const po = await db.get(`
      SELECT po.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
             v.phone as vendor_phone, v.address as vendor_address, v.gst_number,
             r.rfq_number, r.title as rfq_title,
             u.name as created_by_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      JOIN rfqs r ON po.rfq_id = r.id
      JOIN users u ON po.created_by = u.id
      WHERE po.id = ?
    `, req.params.id);

    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    po.items = await db.all('SELECT * FROM po_items WHERE po_id = ?', po.id);

    res.json({ purchaseOrder: po });
  } catch (err) {
    next(err);
  }
});

// POST /api/purchase-orders — generate PO from approved quotation
router.post('/', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { rfq_id, quotation_id, tax_rate } = req.body;
    const db = getDB();

    if (!rfq_id || !quotation_id) {
      return res.status(400).json({ error: 'RFQ and quotation are required' });
    }

    // Check approval
    const approval = await db.get("SELECT * FROM approvals WHERE rfq_id = ? AND action = 'approved'", rfq_id);
    if (!approval) {
      return res.status(400).json({ error: 'RFQ has not been approved yet' });
    }

    // Check no existing PO
    const existingPO = await db.get('SELECT id FROM purchase_orders WHERE rfq_id = ?', rfq_id);
    if (existingPO) {
      return res.status(409).json({ error: 'Purchase order already exists for this RFQ' });
    }

    const quotation = await db.get('SELECT * FROM quotations WHERE id = ?', quotation_id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const rate = tax_rate || 18;
    const subtotal = quotation.total_amount;
    const taxAmount = subtotal * (rate / 100);
    const grandTotal = subtotal + taxAmount;

    const poNumber = generatePONumber();

    const result = await db.run(`
      INSERT INTO purchase_orders (po_number, rfq_id, quotation_id, vendor_id, created_by, subtotal, tax_rate, tax_amount, grand_total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `, poNumber, rfq_id, quotation_id, quotation.vendor_id, req.user.id, subtotal, rate, taxAmount, grandTotal);

    const poId = result.lastInsertRowid;

    // Copy quotation items to PO items
    const qItems = await db.all(`
      SELECT qi.*, ri.product_name, ri.description, ri.quantity, ri.unit
      FROM quotation_items qi
      JOIN rfq_items ri ON qi.rfq_item_id = ri.id
      WHERE qi.quotation_id = ?
    `, quotation_id);

    for (const item of qItems) {
      await db.run(`
        INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, poId, item.product_name, item.description, item.quantity, item.unit, item.unit_price, item.total_price);
    }

    await logActivity(req.user.id, req.user.name, 'po_created', 'purchase_order', poId, `Purchase Order ${poNumber} created`);

    res.status(201).json({ message: 'Purchase order created', id: poId, po_number: poNumber });
  } catch (err) {
    next(err);
  }
});

// PUT /api/purchase-orders/:id
router.put('/:id', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const db = getDB();

    const po = await db.get('SELECT * FROM purchase_orders WHERE id = ?', req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    if (status) {
      await db.run("UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, req.params.id);
      await logActivity(req.user.id, req.user.name, 'po_status_updated', 'purchase_order', req.params.id, `PO ${po.po_number} status: ${status}`);
    }

    res.json({ message: 'Purchase order updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
