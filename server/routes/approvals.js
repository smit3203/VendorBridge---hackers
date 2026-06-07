const express = require('express');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

async function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`, userId, userName, action, entityType, entityId, details);
}

// GET /api/approvals
router.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const { rfq_id, action, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'manager') {
      where.push('a.approver_id = ?');
      params.push(req.user.id);
    }
    if (rfq_id) { where.push('a.rfq_id = ?'); params.push(rfq_id); }
    if (action) { where.push('a.action = ?'); params.push(action); }

    const totalRow = await db.get(`SELECT COUNT(*) as count FROM approvals a WHERE ${where.join(' AND ')}`, ...params);
    const total = totalRow ? parseInt(totalRow.count || 0) : 0;

    const approvals = await db.all(`
      SELECT a.*, r.rfq_number, r.title as rfq_title, r.deadline,
             u.name as approver_name,
             q.quotation_number, q.total_amount, q.delivery_timeline,
             v.company_name as vendor_name
      FROM approvals a
      JOIN rfqs r ON a.rfq_id = r.id
      JOIN users u ON a.approver_id = u.id
      LEFT JOIN quotations q ON a.quotation_id = q.id
      LEFT JOIN vendors v ON q.vendor_id = v.id
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(limit), parseInt(offset));

    res.json({ approvals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// POST /api/approvals — initiate approval workflow
router.post('/', authenticate, authorize('admin', 'procurement_officer'), async (req, res, next) => {
  try {
    const { rfq_id, quotation_id, approver_id } = req.body;
    const db = getDB();

    if (!rfq_id || !approver_id) {
      return res.status(400).json({ error: 'RFQ and approver are required' });
    }

    // Check if approval already exists
    const existing = await db.get('SELECT id FROM approvals WHERE rfq_id = ? AND action = ?', rfq_id, 'pending');
    if (existing) {
      return res.status(409).json({ error: 'An approval request already exists for this RFQ' });
    }

    const result = await db.run(`
      INSERT INTO approvals (rfq_id, quotation_id, approver_id, action)
      VALUES (?, ?, ?, 'pending')
    `, rfq_id, quotation_id, approver_id);

    await logActivity(req.user.id, req.user.name, 'approval_initiated', 'approval', result.lastInsertRowid, `Approval request initiated for RFQ`);

    res.status(201).json({ message: 'Approval request created', id: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// PUT /api/approvals/:id — approve or reject
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { action, remarks } = req.body;
    const db = getDB();

    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approved" or "rejected"' });
    }

    const approval = await db.get('SELECT * FROM approvals WHERE id = ?', req.params.id);
    if (!approval) return res.status(404).json({ error: 'Approval not found' });

    if (approval.action !== 'pending') {
      return res.status(400).json({ error: 'Approval already processed' });
    }

    // Only the assigned approver or admin can process
    if (req.user.role === 'manager' && approval.approver_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to process this approval' });
    }

    await db.run(`
      UPDATE approvals SET action = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, action, remarks, req.params.id);

    if (action === 'approved') {
      // Mark selected quotation
      if (approval.quotation_id) {
        await db.run("UPDATE quotations SET status = 'selected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", approval.quotation_id);
        // Reject other quotations for this RFQ
        await db.run("UPDATE quotations SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE rfq_id = ? AND id != ? AND status = 'submitted'",
          approval.rfq_id, approval.quotation_id);
      }
      // Update RFQ status
      await db.run("UPDATE rfqs SET status = 'awarded', updated_at = CURRENT_TIMESTAMP WHERE id = ?", approval.rfq_id);
    } else {
      // If rejected, reopen RFQ if needed
      if (approval.quotation_id) {
        await db.run("UPDATE quotations SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", approval.quotation_id);
      }
    }

    await logActivity(req.user.id, req.user.name, `approval_${action}`, 'approval', req.params.id, `Approval ${action}: ${remarks || 'No remarks'}`);

    res.json({ message: `Approval ${action}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
