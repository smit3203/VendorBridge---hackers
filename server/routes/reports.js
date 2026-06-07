const express = require('express');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard — dashboard summary
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const stats = {};

    // Counts
    const totalVendorsRow = await db.get("SELECT COUNT(*) as count FROM vendors WHERE status = 'active'");
    stats.totalVendors = totalVendorsRow ? parseInt(totalVendorsRow.count || 0) : 0;

    const activeRFQsRow = await db.get("SELECT COUNT(*) as count FROM rfqs WHERE status IN ('open', 'draft')");
    stats.activeRFQs = activeRFQsRow ? parseInt(activeRFQsRow.count || 0) : 0;

    const pendingApprovalsRow = await db.get("SELECT COUNT(*) as count FROM approvals WHERE action = 'pending'");
    stats.pendingApprovals = pendingApprovalsRow ? parseInt(pendingApprovalsRow.count || 0) : 0;

    const totalPORow = await db.get('SELECT COUNT(*) as count FROM purchase_orders');
    stats.totalPurchaseOrders = totalPORow ? parseInt(totalPORow.count || 0) : 0;

    const totalInvoicesRow = await db.get('SELECT COUNT(*) as count FROM invoices');
    stats.totalInvoices = totalInvoicesRow ? parseInt(totalInvoicesRow.count || 0) : 0;

    // Financial summary
    const financial = await db.get(`
      SELECT
        COALESCE(SUM(grand_total), 0) as total_po_value,
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN grand_total ELSE 0 END), 0) as confirmed_value
      FROM purchase_orders
    `);
    stats.totalPOValue = financial ? parseFloat(financial.total_po_value) : 0;
    stats.confirmedPOValue = financial ? parseFloat(financial.confirmed_value) : 0;

    const invoiceFinancial = await db.get(`
      SELECT
        COALESCE(SUM(total), 0) as total_invoice_value,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as paid_value,
        COALESCE(SUM(CASE WHEN status = 'sent' THEN total ELSE 0 END), 0) as pending_value
      FROM invoices
    `);
    stats.totalInvoiceValue = invoiceFinancial ? parseFloat(invoiceFinancial.total_invoice_value) : 0;
    stats.paidInvoiceValue = invoiceFinancial ? parseFloat(invoiceFinancial.paid_value) : 0;
    stats.pendingInvoiceValue = invoiceFinancial ? parseFloat(invoiceFinancial.pending_value) : 0;

    // Recent items
    stats.recentPOs = await db.all(`
      SELECT po.*, v.company_name as vendor_name
      FROM purchase_orders po JOIN vendors v ON po.vendor_id = v.id
      ORDER BY po.created_at DESC LIMIT 5
    `);

    stats.recentInvoices = await db.all(`
      SELECT i.*, v.company_name as vendor_name
      FROM invoices i JOIN vendors v ON i.vendor_id = v.id
      ORDER BY i.created_at DESC LIMIT 5
    `);

    stats.recentRFQs = await db.all(`
      SELECT r.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM quotations WHERE rfq_id = r.id) as quotation_count
      FROM rfqs r LEFT JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC LIMIT 5
    `);

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/vendor-performance
router.get('/vendor-performance', authenticate, async (req, res, next) => {
  try {
    const db = getDB();

    const vendors = await db.all(`
      SELECT v.id, v.company_name, v.rating,
        COUNT(DISTINCT q.id) as total_quotations,
        COUNT(DISTINCT CASE WHEN q.status = 'selected' THEN q.id END) as won_quotations,
        COUNT(DISTINCT po.id) as total_pos,
        COALESCE(SUM(po.grand_total), 0) as total_order_value
      FROM vendors v
      LEFT JOIN quotations q ON v.id = q.vendor_id
      LEFT JOIN purchase_orders po ON v.id = po.vendor_id
      WHERE v.status = 'active'
      GROUP BY v.id, v.company_name, v.rating
      ORDER BY total_order_value DESC
    `);

    res.json({ vendors });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/spending-summary
router.get('/spending-summary', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const { period = 'monthly' } = req.query;

    let groupBy;
    if (period === 'monthly') {
      groupBy = db.isPostgres ? "TO_CHAR(po.created_at::TIMESTAMP, 'YYYY-MM')" : "strftime('%Y-%m', po.created_at)";
    } else if (period === 'quarterly') {
      groupBy = db.isPostgres
        ? "TO_CHAR(po.created_at::TIMESTAMP, 'YYYY') || '-Q' || TO_CHAR(po.created_at::TIMESTAMP, 'Q')"
        : "strftime('%Y', po.created_at) || '-Q' || ((CAST(strftime('%m', po.created_at) AS INTEGER) - 1) / 3 + 1)";
    } else {
      groupBy = db.isPostgres ? "TO_CHAR(po.created_at::TIMESTAMP, 'YYYY')" : "strftime('%Y', po.created_at)";
    }

    const spending = await db.all(`
      SELECT ${groupBy} as period,
        COUNT(*) as order_count,
        COALESCE(SUM(po.grand_total), 0) as total_spending
      FROM purchase_orders po
      GROUP BY 1
      ORDER BY period DESC
      LIMIT 12
    `);

    // Spending by vendor
    const vendorSpending = await db.all(`
      SELECT v.company_name, COUNT(po.id) as order_count,
        COALESCE(SUM(po.grand_total), 0) as total_spending
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      GROUP BY v.id, v.company_name
      ORDER BY total_spending DESC
      LIMIT 10
    `);

    res.json({ spending, vendorSpending });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/procurement-trends
router.get('/procurement-trends', authenticate, async (req, res, next) => {
  try {
    const db = getDB();

    const monthlyGroupBy = db.isPostgres ? "TO_CHAR(created_at::TIMESTAMP, 'YYYY-MM')" : "strftime('%Y-%m', created_at)";
    const monthlyRFQs = await db.all(`
      SELECT ${monthlyGroupBy} as month, COUNT(*) as count
      FROM rfqs GROUP BY 1 ORDER BY month DESC LIMIT 12
    `);

    // Reverse items array to maintain chronological order
    monthlyRFQs.reverse();

    const rfqStatusDistribution = await db.all(`
      SELECT status, COUNT(*) as count FROM rfqs GROUP BY status
    `);

    const quotationStats = await db.all(`
      SELECT status, COUNT(*) as count FROM quotations GROUP BY status
    `);

    const topCategories = await db.all(`
      SELECT category, COUNT(*) as vendor_count
      FROM vendors WHERE category IS NOT NULL AND category != ''
      GROUP BY category ORDER BY vendor_count DESC
      LIMIT 10
    `);

    res.json({ monthlyRFQs, rfqStatusDistribution, quotationStats, topCategories });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
