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

function generateRFQNumber() {
  const date = new Date();
  const prefix = 'RFQ';
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${datePart}-${rand}`;
}

// GET /api/rfqs
router.get('/', authenticate, async (req, res, next) => {
  try {
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
      const likeOp = db.isPostgres ? 'ILIKE' : 'LIKE';
      where.push(`(r.title ${likeOp} ? OR r.rfq_number ${likeOp} ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const joinClause = req.user.role === 'vendor' ? 'LEFT JOIN rfq_vendors rv ON r.id = rv.rfq_id' : '';

    const totalRow = await db.get(`SELECT COUNT(DISTINCT r.id) as count FROM rfqs r ${joinClause} WHERE ${where.join(' AND ')}`, ...params);
    const total = totalRow ? parseInt(totalRow.count || 0) : 0;

    const rfqs = await db.all(`
      SELECT DISTINCT r.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM quotations WHERE rfq_id = r.id) as quotation_count
      FROM rfqs r
      LEFT JOIN users u ON r.created_by = u.id
      ${joinClause}
      WHERE ${where.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(limit), parseInt(offset));

    // Get items and assigned vendors for each RFQ using for...of loop to await async calls
    for (const rfq of rfqs) {
      rfq.items = await db.all('SELECT * FROM rfq_items WHERE rfq_id = ?', rfq.id);
      rfq.vendors = await db.all(`
        SELECT v.id, v.company_name, rv.invited_at
        FROM rfq_vendors rv JOIN vendors v ON rv.vendor_id = v.id
        WHERE rv.rfq_id = ?
      `, rfq.id);
    }

    res.json({ rfqs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/rfqs/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const rfq = await db.get(`
      SELECT r.*, u.name as created_by_name FROM rfqs r
      LEFT JOIN users u ON r.created_by = u.id WHERE r.id = ?
    `, req.params.id);

    if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

    rfq.items = await db.all('SELECT * FROM rfq_items WHERE rfq_id = ?', rfq.id);
    rfq.vendors = await db.all(`
      SELECT v.id, v.company_name, v.contact_person, v.email, rv.invited_at
      FROM rfq_vendors rv JOIN vendors v ON rv.vendor_id = v.id
      WHERE rv.rfq_id = ?
    `, rfq.id);
    rfq.quotations = await db.all(`
      SELECT q.*, v.company_name as vendor_name FROM quotations q
      JOIN vendors v ON q.vendor_id = v.id WHERE q.rfq_id = ?
    `, rfq.id);

    res.json({ rfq });
  } catch (err) {
    next(err);
  }
});

// POST /api/rfqs
router.post('/', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { title, description, deadline, items, vendor_ids, status } = req.body;

    if (!title) return res.status(400).json({ error: 'RFQ title is required' });

    const db = getDB();
    const rfqNumber = generateRFQNumber();
    const rfqStatus = status || 'draft';

    const result = await db.run(`
      INSERT INTO rfqs (rfq_number, title, description, created_by, deadline, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, rfqNumber, title, description, req.user.id, deadline, rfqStatus);

    const rfqId = result.lastInsertRowid;

    // Insert items
    if (items && items.length > 0) {
      for (const item of items) {
        await db.run(`
          INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit)
          VALUES (?, ?, ?, ?, ?)
        `, rfqId, item.product_name, item.description, item.quantity, item.unit || 'pcs');
      }
    }

    // Assign vendors
    if (vendor_ids && vendor_ids.length > 0) {
      const insertVendorSql = db.isPostgres
        ? 'INSERT INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?) ON CONFLICT (rfq_id, vendor_id) DO NOTHING'
        : 'INSERT OR IGNORE INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?)';
      for (const vid of vendor_ids) {
        await db.run(insertVendorSql, rfqId, vid);
      }
    }

    await logActivity(req.user.id, req.user.name, 'rfq_created', 'rfq', rfqId, `RFQ "${rfqNumber}" created: ${title}`);

    res.status(201).json({ message: 'RFQ created', id: rfqId, rfq_number: rfqNumber });
  } catch (err) {
    next(err);
  }
});

// PUT /api/rfqs/:id
router.put('/:id', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { title, description, deadline, items, vendor_ids, status } = req.body;
    const db = getDB();
    const rfqId = req.params.id;

    const rfq = await db.get('SELECT * FROM rfqs WHERE id = ?', rfqId);
    if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

    await db.run(`
      UPDATE rfqs SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        deadline = COALESCE(?, deadline),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, title, description, deadline, status, rfqId);

    // Replace items if provided
    if (items) {
      await db.run('DELETE FROM rfq_items WHERE rfq_id = ?', rfqId);
      for (const item of items) {
        await db.run(`
          INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit)
          VALUES (?, ?, ?, ?, ?)
        `, rfqId, item.product_name, item.description, item.quantity, item.unit || 'pcs');
      }
    }

    // Replace vendor assignments if provided
    if (vendor_ids) {
      await db.run('DELETE FROM rfq_vendors WHERE rfq_id = ?', rfqId);
      const insertVendorSql = db.isPostgres
        ? 'INSERT INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?) ON CONFLICT (rfq_id, vendor_id) DO NOTHING'
        : 'INSERT OR IGNORE INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?)';
      for (const vid of vendor_ids) {
        await db.run(insertVendorSql, rfqId, vid);
      }
    }

    await logActivity(req.user.id, req.user.name, 'rfq_updated', 'rfq', rfqId, `RFQ "${rfq.rfq_number}" updated`);

    res.json({ message: 'RFQ updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rfqs/:id
router.delete('/:id', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const db = getDB();
    const rfq = await db.get('SELECT * FROM rfqs WHERE id = ?', req.params.id);
    if (!rfq) return res.status(404).json({ error: 'RFQ not found' });

    await db.run('DELETE FROM rfqs WHERE id = ?', req.params.id);
    await logActivity(req.user.id, req.user.name, 'rfq_deleted', 'rfq', req.params.id, `RFQ "${rfq.rfq_number}" deleted`);

    res.json({ message: 'RFQ deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
