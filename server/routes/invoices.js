const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendInvoiceEmail } = require('../utils/emailService');

const router = express.Router();

function logActivity(userId, userName, action, entityType, entityId, details) {
  const db = getDB();
  db.prepare(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, userName, action, entityType, entityId, details);
}

function generateInvoiceNumber() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${datePart}-${rand}`;
}

// Ensure uploads/invoices directory exists
const invoicesDir = path.join(__dirname, '..', 'uploads', 'invoices');
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

// GET /api/invoices
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  let params = [];

  if (req.user.role === 'vendor') {
    where.push('i.vendor_id = (SELECT id FROM vendors WHERE user_id = ?)');
    params.push(req.user.id);
  }
  if (status) { where.push('i.status = ?'); params.push(status); }
  if (search) {
    where.push('(i.invoice_number LIKE ? OR v.company_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM invoices i JOIN vendors v ON i.vendor_id = v.id WHERE ${where.join(' AND ')}`).get(...params).count;

  const invoices = db.prepare(`
    SELECT i.*, v.company_name as vendor_name, v.email as vendor_email,
           po.po_number
    FROM invoices i
    JOIN vendors v ON i.vendor_id = v.id
    JOIN purchase_orders po ON i.po_id = po.id
    WHERE ${where.join(' AND ')}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({ invoices, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/invoices/:id
router.get('/:id', authenticate, (req, res) => {
  const db = getDB();
  const invoice = db.prepare(`
    SELECT i.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
           v.phone as vendor_phone, v.address as vendor_address, v.gst_number,
           po.po_number, po.subtotal as po_subtotal, po.tax_rate as po_tax_rate,
           r.rfq_number, r.title as rfq_title
    FROM invoices i
    JOIN vendors v ON i.vendor_id = v.id
    JOIN purchase_orders po ON i.po_id = po.id
    JOIN rfqs r ON po.rfq_id = r.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoice.id);

  res.json({ invoice });
});

// POST /api/invoices — generate invoice from PO
router.post('/', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const { po_id, tax_rate } = req.body;
  const db = getDB();

  if (!po_id) return res.status(400).json({ error: 'Purchase order is required' });

  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po_id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });

  // Check no existing invoice
  const existing = db.prepare('SELECT id FROM invoices WHERE po_id = ?').get(po_id);
  if (existing) return res.status(409).json({ error: 'Invoice already exists for this PO' });

  const rate = tax_rate || po.tax_rate || 18;
  const subtotal = po.subtotal;
  const taxAmount = subtotal * (rate / 100);
  const total = subtotal + taxAmount;

  const invoiceNumber = generateInvoiceNumber();

  const result = db.prepare(`
    INSERT INTO invoices (invoice_number, po_id, vendor_id, subtotal, tax_rate, tax_amount, total, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(invoiceNumber, po_id, po.vendor_id, subtotal, rate, taxAmount, total);

  const invoiceId = result.lastInsertRowid;

  // Copy PO items to invoice items
  const poItems = db.prepare('SELECT * FROM po_items WHERE po_id = ?').all(po_id);
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  poItems.forEach(item => {
    insertItem.run(invoiceId, item.product_name, item.description, item.quantity, item.unit, item.unit_price, item.total_price);
  });

  // Generate PDF
  const invoice = db.prepare(`
    SELECT i.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
           v.phone as vendor_phone, v.address as vendor_address, v.gst_number,
           po.po_number, r.rfq_number, r.title as rfq_title
    FROM invoices i
    JOIN vendors v ON i.vendor_id = v.id
    JOIN purchase_orders po ON i.po_id = po.id
    JOIN rfqs r ON po.rfq_id = r.id
    WHERE i.id = ?
  `).get(invoiceId);
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);

  try {
    const pdfPath = path.join(invoicesDir, `${invoiceNumber}.pdf`);
    generateInvoicePDF(invoice, pdfPath);
    db.prepare('UPDATE invoices SET pdf_path = ? WHERE id = ?').run(pdfPath, invoiceId);
  } catch (err) {
    console.error('PDF generation failed:', err.message);
  }

  logActivity(req.user.id, req.user.name, 'invoice_created', 'invoice', invoiceId, `Invoice ${invoiceNumber} generated`);

  res.status(201).json({ message: 'Invoice generated', id: invoiceId, invoice_number: invoiceNumber });
});

// GET /api/invoices/:id/download — download PDF
router.get('/:id/download', authenticate, (req, res) => {
  const db = getDB();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (!invoice.pdf_path || !fs.existsSync(invoice.pdf_path)) {
    // Regenerate PDF
    const fullInvoice = db.prepare(`
      SELECT i.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
             v.phone as vendor_phone, v.address as vendor_address, v.gst_number,
             po.po_number, r.rfq_number, r.title as rfq_title
      FROM invoices i
      JOIN vendors v ON i.vendor_id = v.id
      JOIN purchase_orders po ON i.po_id = po.id
      JOIN rfqs r ON po.rfq_id = r.id
      WHERE i.id = ?
    `).get(req.params.id);
    fullInvoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoice.id);

    const pdfPath = path.join(invoicesDir, `${invoice.invoice_number}.pdf`);
    generateInvoicePDF(fullInvoice, pdfPath);
    db.prepare('UPDATE invoices SET pdf_path = ? WHERE id = ?').run(pdfPath, invoice.id);
    invoice.pdf_path = pdfPath;
  }

  res.download(invoice.pdf_path, `${invoice.invoice_number}.pdf`);
});

// POST /api/invoices/:id/send — email invoice
router.post('/:id/send', authenticate, authorize('admin', 'procurement_officer'), async (req, res) => {
  const db = getDB();
  const invoice = db.prepare(`
    SELECT i.*, v.company_name as vendor_name, v.contact_person, v.email as vendor_email,
           po.po_number
    FROM invoices i
    JOIN vendors v ON i.vendor_id = v.id
    JOIN purchase_orders po ON i.po_id = po.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  // Ensure PDF exists
  if (!invoice.pdf_path || !fs.existsSync(invoice.pdf_path)) {
    return res.status(400).json({ error: 'Invoice PDF not generated. Download the invoice first to generate the PDF.' });
  }

  const recipientEmail = req.body.email || invoice.vendor_email;
  if (!recipientEmail) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  try {
    await sendInvoiceEmail({
      to: recipientEmail,
      invoiceNumber: invoice.invoice_number,
      vendorName: invoice.vendor_name,
      total: invoice.total,
      pdfPath: invoice.pdf_path
    });

    db.prepare("UPDATE invoices SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(invoice.id);
    logActivity(req.user.id, req.user.name, 'invoice_sent', 'invoice', invoice.id, `Invoice ${invoice.invoice_number} emailed to ${recipientEmail}`);

    res.json({ message: 'Invoice sent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', authenticate, authorize('admin', 'procurement_officer'), (req, res) => {
  const { status } = req.body;
  const db = getDB();

  const validStatuses = ['draft', 'sent', 'paid', 'overdue'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  let updateFields = "status = ?, updated_at = datetime('now')";
  let params = [status];

  if (status === 'paid') {
    updateFields += ", paid_at = datetime('now')";
  }

  db.prepare(`UPDATE invoices SET ${updateFields} WHERE id = ?`).run(...params, req.params.id);
  logActivity(req.user.id, req.user.name, 'invoice_status_updated', 'invoice', req.params.id, `Invoice ${invoice.invoice_number} status: ${status}`);

  res.json({ message: 'Invoice status updated' });
});

module.exports = router;
