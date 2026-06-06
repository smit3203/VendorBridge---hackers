const express = require('express');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard — dashboard summary
router.get('/dashboard', authenticate, (req, res) => {
  const db = getDB();

  const stats = {};

  // Counts
  stats.totalVendors = db.prepare("SELECT COUNT(*) as count FROM vendors WHERE status = 'active'").get().count;
  stats.activeRFQs = db.prepare("SELECT COUNT(*) as count FROM rfqs WHERE status IN ('open', 'draft')").get().count;
  stats.pendingApprovals = db.prepare("SELECT COUNT(*) as count FROM approvals WHERE action = 'pending'").get().count;
  stats.totalPurchaseOrders = db.prepare('SELECT COUNT(*) as count FROM purchase_orders').get().count;
  stats.totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;

  // Financial summary
  const financial = db.prepare(`
    SELECT
      COALESCE(SUM(grand_total), 0) as total_po_value,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN grand_total ELSE 0 END), 0) as confirmed_value
    FROM purchase_orders
  `).get();
  stats.totalPOValue = financial.total_po_value;
  stats.confirmedPOValue = financial.confirmed_value;

  const invoiceFinancial = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as total_invoice_value,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as paid_value,
      COALESCE(SUM(CASE WHEN status = 'sent' THEN total ELSE 0 END), 0) as pending_value
    FROM invoices
  `).get();
  stats.totalInvoiceValue = invoiceFinancial.total_invoice_value;
  stats.paidInvoiceValue = invoiceFinancial.paid_value;
  stats.pendingInvoiceValue = invoiceFinancial.pending_value;

  // Recent items
  stats.recentPOs = db.prepare(`
    SELECT po.*, v.company_name as vendor_name
    FROM purchase_orders po JOIN vendors v ON po.vendor_id = v.id
    ORDER BY po.created_at DESC LIMIT 5
  `).all();

  stats.recentInvoices = db.prepare(`
    SELECT i.*, v.company_name as vendor_name
    FROM invoices i JOIN vendors v ON i.vendor_id = v.id
    ORDER BY i.created_at DESC LIMIT 5
  `).all();

  stats.recentRFQs = db.prepare(`
    SELECT r.*, u.name as created_by_name,
      (SELECT COUNT(*) FROM quotations WHERE rfq_id = r.id) as quotation_count
    FROM rfqs r LEFT JOIN users u ON r.created_by = u.id
    ORDER BY r.created_at DESC LIMIT 5
  `).all();

  res.json(stats);
});

// GET /api/reports/vendor-performance
router.get('/vendor-performance', authenticate, (req, res) => {
  const db = getDB();

  const vendors = db.prepare(`
    SELECT v.id, v.company_name, v.rating,
      COUNT(DISTINCT q.id) as total_quotations,
      COUNT(DISTINCT CASE WHEN q.status = 'selected' THEN q.id END) as won_quotations,
      COUNT(DISTINCT po.id) as total_pos,
      COALESCE(SUM(po.grand_total), 0) as total_order_value
    FROM vendors v
    LEFT JOIN quotations q ON v.id = q.vendor_id
    LEFT JOIN purchase_orders po ON v.id = po.vendor_id
    WHERE v.status = 'active'
    GROUP BY v.id
    ORDER BY total_order_value DESC
  `).all();

  res.json({ vendors });
});

// GET /api/reports/spending-summary
router.get('/spending-summary', authenticate, (req, res) => {
  const db = getDB();
  const { period = 'monthly' } = req.query;

  let groupBy, dateFormat;
  if (period === 'monthly') {
    groupBy = "strftime('%Y-%m', po.created_at)";
    dateFormat = '%Y-%m';
  } else if (period === 'quarterly') {
    groupBy = "strftime('%Y', po.created_at) || '-Q' || ((CAST(strftime('%m', po.created_at) AS INTEGER) - 1) / 3 + 1)";
    dateFormat = null;
  } else {
    groupBy = "strftime('%Y', po.created_at)";
    dateFormat = '%Y';
  }

  const spending = db.prepare(`
    SELECT ${groupBy} as period,
      COUNT(*) as order_count,
      COALESCE(SUM(po.grand_total), 0) as total_spending
    FROM purchase_orders po
    GROUP BY ${groupBy}
    ORDER BY period DESC
    LIMIT 12
  `).all();

  // Spending by vendor
  const vendorSpending = db.prepare(`
    SELECT v.company_name, COUNT(po.id) as order_count,
      COALESCE(SUM(po.grand_total), 0) as total_spending
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    GROUP BY v.id
    ORDER BY total_spending DESC
    LIMIT 10
  `).all();

  res.json({ spending, vendorSpending });
});

// GET /api/reports/procurement-trends
router.get('/procurement-trends', authenticate, (req, res) => {
  const db = getDB();

  const monthlyRFQs = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM rfqs GROUP BY month ORDER BY month DESC LIMIT 12
  `).all().reverse();

  const rfqStatusDistribution = db.prepare(`
    SELECT status, COUNT(*) as count FROM rfqs GROUP BY status
  `).all();

  const quotationStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM quotations GROUP BY status
  `).all();

  const topCategories = db.prepare(`
    SELECT category, COUNT(*) as vendor_count
    FROM vendors WHERE category IS NOT NULL AND category != ''
    GROUP BY category ORDER BY vendor_count DESC
    LIMIT 10
  `).all();

  res.json({ monthlyRFQs, rfqStatusDistribution, quotationStats, topCategories });
});

module.exports = router;
