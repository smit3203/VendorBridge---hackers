require('dotenv').config({ path: '../../.env' });
const bcrypt = require('bcryptjs');
const { initDB, getDB } = require('../config/database');

async function seed() {
  // Initialize the database connection and tables
  await initDB();
  const db = getDB();

  console.log('Seeding database...');

  try {
    // Clear existing data in correct dependency order to avoid foreign key errors
    await db.exec(`
      DELETE FROM activity_logs;
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM po_items;
      DELETE FROM purchase_orders;
      DELETE FROM approvals;
      DELETE FROM quotation_items;
      DELETE FROM quotations;
      DELETE FROM rfq_vendors;
      DELETE FROM rfq_items;
      DELETE FROM rfqs;
      DELETE FROM vendors;
      DELETE FROM users;
    `);

    const hash = bcrypt.hashSync('password123', 10);

    // Users
    const admin = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'Admin User', 'admin@vendorbridge.com', hash, 'admin')).lastInsertRowid;
    const officer1 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'Sarah Johnson', 'sarah@vendorbridge.com', hash, 'procurement_officer')).lastInsertRowid;
    const officer2 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'Mike Chen', 'mike@vendorbridge.com', hash, 'procurement_officer')).lastInsertRowid;
    const manager1 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'David Park', 'david@vendorbridge.com', hash, 'manager')).lastInsertRowid;
    const manager2 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'Lisa Wong', 'lisa@vendorbridge.com', hash, 'manager')).lastInsertRowid;
    const vendorUser1 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'Raj Industries', 'raj@vendorbridge.com', hash, 'vendor')).lastInsertRowid;
    const vendorUser2 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'TechSupply Co', 'tech@vendorbridge.com', hash, 'vendor')).lastInsertRowid;
    const vendorUser3 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'Global Parts Ltd', 'global@vendorbridge.com', hash, 'vendor')).lastInsertRowid;
    const vendorUser4 = (await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 'QuickShip Corp', 'quick@vendorbridge.com', hash, 'vendor')).lastInsertRowid;

    // Vendors
    const v1 = (await db.run(
      `INSERT INTO vendors (user_id, company_name, contact_person, email, phone, address, gst_number, category, status, rating) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      vendorUser1, 'Raj Industries Pvt Ltd', 'Rajesh Kumar', 'raj@vendorbridge.com', '+91-9876543210', '123 Industrial Area, Mumbai, MH 400001', 'GSTIN27AABCR1234M', 'Electronics', 'active', 4.5
    )).lastInsertRowid;

    const v2 = (await db.run(
      `INSERT INTO vendors (user_id, company_name, contact_person, email, phone, address, gst_number, category, status, rating) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      vendorUser2, 'TechSupply Co', 'Amanda Lee', 'tech@vendorbridge.com', '+1-555-0123', '456 Tech Blvd, San Francisco, CA 94102', 'US-TAX-98765', 'Technology', 'active', 4.2
    )).lastInsertRowid;

    const v3 = (await db.run(
      `INSERT INTO vendors (user_id, company_name, contact_person, email, phone, address, gst_number, category, status, rating) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      vendorUser3, 'Global Parts Ltd', 'Chen Wei', 'global@vendorbridge.com', '+86-138-0000-1234', '789 Manufacturing Rd, Shenzhen, GD 518000', 'CN-TAX-12345', 'Raw Materials', 'active', 3.8
    )).lastInsertRowid;

    const v4 = (await db.run(
      `INSERT INTO vendors (user_id, company_name, contact_person, email, phone, address, gst_number, category, status, rating) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      vendorUser4, 'QuickShip Corp', 'Emily Davis', 'quick@vendorbridge.com', '+44-20-7946-0958', '10 Logistics Park, London, UK EC1A 1BB', 'GB-TAX-67890', 'Logistics', 'pending', 4.0
    )).lastInsertRowid;

    // RFQ 1
    const rfq1 = (await db.run(
      `INSERT INTO rfqs (rfq_number, title, description, created_by, deadline, status) VALUES (?, ?, ?, ?, ?, ?)`,
      'RFQ-20250601-1001', 'Laptop Procurement Q2 2025', 'Bulk procurement of business laptops for the engineering department', officer1, '2025-07-15', 'open'
    )).lastInsertRowid;

    await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq1, 'Business Laptop - i7/16GB/512SSD', 'Dell Latitude or equivalent', 50, 'pcs');
    await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq1, 'Laptop Docking Station', 'USB-C universal docking station', 50, 'pcs');
    await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq1, 'Wireless Mouse & Keyboard Combo', 'Ergonomic wireless combo', 50, 'sets');

    const insertVendorSql = db.isPostgres
      ? 'INSERT INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?) ON CONFLICT (rfq_id, vendor_id) DO NOTHING'
      : 'INSERT OR IGNORE INTO rfq_vendors (rfq_id, vendor_id) VALUES (?, ?)';

    await db.run(insertVendorSql, rfq1, v1);
    await db.run(insertVendorSql, rfq1, v2);
    await db.run(insertVendorSql, rfq1, v3);

    // RFQ 2
    const rfq2 = (await db.run(
      `INSERT INTO rfqs (rfq_number, title, description, created_by, deadline, status) VALUES (?, ?, ?, ?, ?, ?)`,
      'RFQ-20250601-1002', 'Office Furniture - New Branch', 'Complete office furniture setup for new branch office', officer1, '2025-08-01', 'awarded'
    )).lastInsertRowid;

    const rfq2Item1 = (await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq2, 'Ergonomic Office Chair', 'Adjustable lumbar support, mesh back', 30, 'pcs')).lastInsertRowid;
    const rfq2Item2 = (await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq2, 'Standing Desk - Electric', 'Height adjustable 140x70cm', 30, 'pcs')).lastInsertRowid;
    const rfq2Item3 = (await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq2, 'Filing Cabinet - 4 Drawer', 'Metal lockable cabinet', 15, 'pcs')).lastInsertRowid;

    await db.run(insertVendorSql, rfq2, v1);
    await db.run(insertVendorSql, rfq2, v3);
    await db.run(insertVendorSql, rfq2, v4);

    // RFQ 3
    const rfq3 = (await db.run(
      `INSERT INTO rfqs (rfq_number, title, description, created_by, deadline, status) VALUES (?, ?, ?, ?, ?, ?)`,
      'RFQ-20250515-1003', 'Server Infrastructure Upgrade', 'Cloud-ready server infrastructure for data center', officer2, '2025-06-30', 'open'
    )).lastInsertRowid;

    const rfq3Item1 = (await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq3, 'Rack Server - 2U', 'Dual CPU, 256GB RAM, 8x NVMe', 5, 'pcs')).lastInsertRowid;
    const rfq3Item2 = (await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq3, 'Network Switch - 48 Port', '10GbE managed switch', 3, 'pcs')).lastInsertRowid;
    const rfq3Item3 = (await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq3, 'UPS System - 10kVA', 'Online double conversion UPS', 2, 'pcs')).lastInsertRowid;

    await db.run(insertVendorSql, rfq3, v2);
    await db.run(insertVendorSql, rfq3, v3);

    // RFQ 4 (Draft)
    const rfq4 = (await db.run(
      `INSERT INTO rfqs (rfq_number, title, description, created_by, deadline, status) VALUES (?, ?, ?, ?, ?, ?)`,
      'RFQ-20250605-1004', 'Marketing Materials 2025', 'Print and digital marketing collateral', officer2, '2025-09-01', 'draft'
    )).lastInsertRowid;

    await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq4, 'Brochures (Tri-fold)', 'Full color, premium paper', 5000, 'pcs');
    await db.run(`INSERT INTO rfq_items (rfq_id, product_name, description, quantity, unit) VALUES (?, ?, ?, ?, ?)`, rfq4, 'Business Cards', 'Premium stock, double-sided', 2000, 'pcs');

    await db.run(insertVendorSql, rfq4, v1);
    await db.run(insertVendorSql, rfq4, v4);

    // Quotations for RFQ 2 (awarded)
    // Vendor 1 quotation for RFQ 2
    const q1 = (await db.run(
      `INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'QT-20250602-2001', rfq2, v1, 285000, '3-4 weeks', 'Bulk discount applied', 'selected'
    )).lastInsertRowid;

    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q1, rfq2Item1, 4500, 135000, 'Premium ergonomic chairs');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q1, rfq2Item2, 4200, 126000, 'Electric standing desks with cable management');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q1, rfq2Item3, 1600, 24000, 'Metal filing cabinets with lock');

    // Vendor 3 quotation for RFQ 2
    const q2 = (await db.run(
      `INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'QT-20250602-2002', rfq2, v3, 310000, '4-5 weeks', 'Includes installation', 'rejected'
    )).lastInsertRowid;

    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q2, rfq2Item1, 5200, 156000, 'High-end ergonomic chairs');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q2, rfq2Item2, 4500, 135000, 'Premium standing desks');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q2, rfq2Item3, 1267, 19005, 'Standard filing cabinets');

    // Vendor 4 quotation for RFQ 2
    const q3 = (await db.run(
      `INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'QT-20250603-2003', rfq2, v4, 295000, '2-3 weeks', 'Fastest delivery option', 'rejected'
    )).lastInsertRowid;

    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q3, rfq2Item1, 4800, 144000, 'Ergonomic mesh chairs');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q3, rfq2Item2, 4300, 129000, 'Standing desks with memory presets');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q3, rfq2Item3, 1467, 22005, 'Heavy-duty filing cabinets');

    // Quotations for RFQ 1 (open)
    // Get RFQ 1 items to map IDs
    const rfq1Items = await db.all('SELECT * FROM rfq_items WHERE rfq_id = ?', rfq1);

    const q4 = (await db.run(
      `INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'QT-20250603-2004', rfq1, v1, 725000, '2 weeks', 'Dell Latitude 5540 with 3-year warranty', 'submitted'
    )).lastInsertRowid;

    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q4, rfq1Items[0].id, 12000, 600000, 'Dell Latitude 5540 i7/16GB/512SSD');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q4, rfq1Items[1].id, 2000, 100000, 'Dell WD19S USB-C Dock');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q4, rfq1Items[2].id, 500, 25000, 'Logitech MK850 Combo');

    const q5 = (await db.run(
      `INSERT INTO quotations (quotation_number, rfq_id, vendor_id, total_amount, delivery_timeline, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'QT-20250603-2005', rfq1, v2, 690000, '3 weeks', 'HP EliteBook 840 G10, enterprise support included', 'submitted'
    )).lastInsertRowid;

    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q5, rfq1Items[0].id, 11500, 575000, 'HP EliteBook 840 G10 i7/16GB/512SSD');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q5, rfq1Items[1].id, 1800, 90000, 'HP USB-C Dock G5');
    await db.run(`INSERT INTO quotation_items (quotation_id, rfq_item_id, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?)`, q5, rfq1Items[2].id, 500, 25000, 'HP 230 Wireless Combo');

    // Approvals
    await db.run(
      `INSERT INTO approvals (rfq_id, quotation_id, approver_id, action, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      rfq2, q1, manager1, 'approved', 'Best value with reasonable timeline. Approved for procurement.', '2025-06-03 10:00:00'
    );

    // Purchase Order for RFQ 2
    const po1 = (await db.run(
      `INSERT INTO purchase_orders (po_number, rfq_id, quotation_id, vendor_id, created_by, subtotal, tax_rate, tax_amount, grand_total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'PO-20250603-3001', rfq2, q1, v1, officer1, 285000, 18, 51300, 336300, 'confirmed'
    )).lastInsertRowid;

    await db.run(`INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`, po1, 'Ergonomic Office Chair', 'Adjustable lumbar support, mesh back', 30, 'pcs', 4500, 135000);
    await db.run(`INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`, po1, 'Standing Desk - Electric', 'Height adjustable 140x70cm', 30, 'pcs', 4200, 126000);
    await db.run(`INSERT INTO po_items (po_id, product_name, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`, po1, 'Filing Cabinet - 4 Drawer', 'Metal lockable cabinet', 15, 'pcs', 1600, 24000);

    // Invoice for PO
    const inv1 = (await db.run(
      `INSERT INTO invoices (invoice_number, po_id, vendor_id, subtotal, tax_rate, tax_amount, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'INV-20250603-4001', po1, v1, 285000, 18, 51300, 336300, 'sent', '2025-06-03 14:00:00'
    )).lastInsertRowid;

    await db.run(`INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`, inv1, 'Ergonomic Office Chair', 'Adjustable lumbar support, mesh back', 30, 'pcs', 4500, 135000);
    await db.run(`INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`, inv1, 'Standing Desk - Electric', 'Height adjustable 140x70cm', 30, 'pcs', 4200, 126000);
    await db.run(`INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`, inv1, 'Filing Cabinet - 4 Drawer', 'Metal lockable cabinet', 15, 'pcs', 1600, 24000);

    // Activity Logs
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, officer1, 'Sarah Johnson', 'rfq_created', 'rfq', rfq1, 'RFQ RFQ-20250601-1001 created: Laptop Procurement Q2 2025', '2025-06-01 09:00:00');
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, officer1, 'Sarah Johnson', 'rfq_created', 'rfq', rfq2, 'RFQ RFQ-20250601-1002 created: Office Furniture - New Branch', '2025-06-01 10:00:00');
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, vendorUser1, 'Raj Industries', 'quotation_submitted', 'quotation', q1, 'Quotation QT-20250602-2001 submitted', '2025-06-02 14:00:00');
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, vendorUser3, 'Global Parts Ltd', 'quotation_submitted', 'quotation', q2, 'Quotation QT-20250602-2002 submitted', '2025-06-02 16:00:00');
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, manager1, 'David Park', 'approval_approved', 'approval', 1, 'Approval approved: Best value with reasonable timeline', '2025-06-03 10:00:00');
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, officer1, 'Sarah Johnson', 'po_created', 'purchase_order', po1, 'Purchase Order PO-20250603-3001 created', '2025-06-03 11:00:00');
    await db.run(`INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, officer1, 'Sarah Johnson', 'invoice_created', 'invoice', inv1, 'Invoice INV-20250603-4001 generated', '2025-06-03 14:00:00');

    console.log('Seed data inserted successfully!');
    console.log('\n--- Test Credentials ---');
    console.log('Admin:      admin@vendorbridge.com / password123');
    console.log('Officer:    sarah@vendorbridge.com / password123');
    console.log('Manager:    david@vendorbridge.com / password123');
    console.log('Vendor:     raj@vendorbridge.com / password123');
    console.log('------------------------\n');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
