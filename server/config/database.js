const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'vendorbridge.db');

let pgPool = null;
let sqliteDb = null;
let isPostgres = false;

// Check if DATABASE_URL is set (from Supabase or local Postgres)
if (process.env.DATABASE_URL) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
  });
  isPostgres = true;
  console.log('Database configuration: Supabase/PostgreSQL active');
} else {
  isPostgres = false;
  console.log('Database configuration: SQLite active');
}

function getDB() {
  if (isPostgres) {
    // Return PostgreSQL pool wrapper
    return dbWrapper;
  }
  
  if (!sqliteDb) {
    sqliteDb = new Database(DB_PATH);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
  }
  return dbWrapper;
}

const normalizeParams = (args) => {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  // If args[0] is undefined or null but args length is 1, keep it
  return args;
};

const dbWrapper = {
  isPostgres,

  query: async (sql, ...args) => {
    const params = normalizeParams(args);
    if (isPostgres) {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      return pgPool.query(pgSql, params);
    } else {
      if (!sqliteDb) getDB();
      return sqliteDb.prepare(sql).run(...params);
    }
  },

  get: async (sql, ...args) => {
    const params = normalizeParams(args);
    if (isPostgres) {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      const res = await pgPool.query(pgSql, params);
      return res.rows[0] || null;
    } else {
      if (!sqliteDb) getDB();
      return sqliteDb.prepare(sql).get(...params);
    }
  },

  all: async (sql, ...args) => {
    const params = normalizeParams(args);
    if (isPostgres) {
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    } else {
      if (!sqliteDb) getDB();
      return sqliteDb.prepare(sql).all(...params);
    }
  },

  run: async (sql, ...args) => {
    const params = normalizeParams(args);
    if (isPostgres) {
      let pgSql = sql;
      // Convert SQLite's INSERT OR IGNORE to standard Postgres
      pgSql = pgSql.replace(/INSERT OR IGNORE/gi, 'INSERT');

      // Append returning clause if missing for insertions to match SQLite's lastInsertRowid behavior
      if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
        pgSql = pgSql.trim().replace(/;?$/, ' RETURNING id');
      }

      // Handle rfq_vendors duplicate resolution
      if (sql.toUpperCase().includes('RFQ_VENDORS') && !sql.toUpperCase().includes('ON CONFLICT')) {
        pgSql = pgSql.replace(/RETURNING id/gi, 'ON CONFLICT (rfq_id, vendor_id) DO NOTHING RETURNING id');
      }

      let index = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${index++}`);

      const res = await pgPool.query(pgSql, params);
      const lastInsertRowid = res.rows[0] ? res.rows[0].id : null;
      return {
        lastInsertRowid,
        changes: res.rowCount
      };
    } else {
      if (!sqliteDb) getDB();
      const result = sqliteDb.prepare(sql).run(...params);
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes
      };
    }
  },

  exec: async (sql) => {
    if (isPostgres) {
      return pgPool.query(sql);
    } else {
      if (!sqliteDb) getDB();
      return sqliteDb.exec(sql);
    }
  }
};

async function initDB() {
  if (isPostgres) {
    try {
      console.log('Initializing PostgreSQL database schema...');
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role VARCHAR(50) NOT NULL CHECK(role IN ('admin','procurement_officer','vendor','manager')),
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS vendors (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          company_name TEXT NOT NULL,
          contact_person TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          gst_number TEXT,
          category TEXT,
          status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active','inactive','pending')),
          rating REAL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS rfqs (
          id SERIAL PRIMARY KEY,
          rfq_number TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          created_by INTEGER NOT NULL,
          deadline TEXT,
          status VARCHAR(20) DEFAULT 'draft' CHECK(status IN ('draft','open','closed','awarded','cancelled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS rfq_items (
          id SERIAL PRIMARY KEY,
          rfq_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          description TEXT,
          quantity REAL NOT NULL,
          unit TEXT DEFAULT 'pcs',
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS rfq_vendors (
          id SERIAL PRIMARY KEY,
          rfq_id INTEGER NOT NULL,
          vendor_id INTEGER NOT NULL,
          invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
          FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
          UNIQUE(rfq_id, vendor_id)
        );

        CREATE TABLE IF NOT EXISTS quotations (
          id SERIAL PRIMARY KEY,
          quotation_number TEXT UNIQUE NOT NULL,
          rfq_id INTEGER NOT NULL,
          vendor_id INTEGER NOT NULL,
          total_amount REAL NOT NULL DEFAULT 0,
          delivery_timeline TEXT,
          notes TEXT,
          status VARCHAR(20) DEFAULT 'submitted' CHECK(status IN ('submitted','selected','rejected','cancelled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
          FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS quotation_items (
          id SERIAL PRIMARY KEY,
          quotation_id INTEGER NOT NULL,
          rfq_item_id INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          notes TEXT,
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
          FOREIGN KEY (rfq_item_id) REFERENCES rfq_items(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS approvals (
          id SERIAL PRIMARY KEY,
          rfq_id INTEGER NOT NULL,
          quotation_id INTEGER,
          approver_id INTEGER NOT NULL,
          action VARCHAR(20) DEFAULT 'pending' CHECK(action IN ('pending','approved','rejected')),
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
          FOREIGN KEY (approver_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
          id SERIAL PRIMARY KEY,
          po_number TEXT UNIQUE NOT NULL,
          rfq_id INTEGER NOT NULL,
          quotation_id INTEGER NOT NULL,
          vendor_id INTEGER NOT NULL,
          created_by INTEGER NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          tax_rate REAL DEFAULT 18,
          tax_amount REAL NOT NULL DEFAULT 0,
          grand_total REAL NOT NULL DEFAULT 0,
          status VARCHAR(20) DEFAULT 'draft' CHECK(status IN ('draft','confirmed','completed','cancelled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id),
          FOREIGN KEY (quotation_id) REFERENCES quotations(id),
          FOREIGN KEY (vendor_id) REFERENCES vendors(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS po_items (
          id SERIAL PRIMARY KEY,
          po_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          description TEXT,
          quantity REAL NOT NULL,
          unit TEXT DEFAULT 'pcs',
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invoices (
          id SERIAL PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          po_id INTEGER NOT NULL,
          vendor_id INTEGER NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          tax_rate REAL DEFAULT 18,
          tax_amount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          status VARCHAR(20) DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue')),
          pdf_path TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sent_at TIMESTAMP,
          paid_at TIMESTAMP,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
          FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        );

        CREATE TABLE IF NOT EXISTS invoice_items (
          id SERIAL PRIMARY KEY,
          invoice_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          description TEXT,
          quantity REAL NOT NULL,
          unit TEXT DEFAULT 'pcs',
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          user_name TEXT,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id INTEGER,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS attachments (
          id SERIAL PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          filepath TEXT NOT NULL,
          mimetype TEXT,
          size INTEGER,
          uploaded_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rfq_status ON rfqs(status);
        CREATE INDEX IF NOT EXISTS idx_quotation_rfq ON quotations(rfq_id);
        CREATE INDEX IF NOT EXISTS idx_quotation_vendor ON quotations(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_approval_rfq ON approvals(rfq_id);
        CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_po ON invoices(po_id);
        CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
      `);
      console.log('PostgreSQL database initialized successfully');
    } catch (err) {
      console.error('Error initializing PostgreSQL schema:', err);
      throw err;
    }
  } else {
    const database = getDB();
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','procurement_officer','vendor','manager')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        company_name TEXT NOT NULL,
        contact_person TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        gst_number TEXT,
        category TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','pending')),
        rating REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS rfqs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rfq_number TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL,
        deadline TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','open','closed','awarded','cancelled')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS rfq_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rfq_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        description TEXT,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT 'pcs',
        FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS rfq_vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rfq_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        invited_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        UNIQUE(rfq_id, vendor_id)
      );

      CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_number TEXT UNIQUE NOT NULL,
        rfq_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        delivery_timeline TEXT,
        notes TEXT,
        status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','selected','rejected','cancelled')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        rfq_item_id INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        notes TEXT,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (rfq_item_id) REFERENCES rfq_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rfq_id INTEGER NOT NULL,
        quotation_id INTEGER,
        approver_id INTEGER NOT NULL,
        action TEXT DEFAULT 'pending' CHECK(action IN ('pending','approved','rejected')),
        remarks TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
        FOREIGN KEY (approver_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        rfq_id INTEGER NOT NULL,
        quotation_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        tax_rate REAL DEFAULT 18,
        tax_amount REAL NOT NULL DEFAULT 0,
        grand_total REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','confirmed','completed','cancelled')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (rfq_id) REFERENCES rfqs(id),
        FOREIGN KEY (quotation_id) REFERENCES quotations(id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS po_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        description TEXT,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT 'pcs',
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        po_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        tax_rate REAL DEFAULT 18,
        tax_amount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue')),
        pdf_path TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        sent_at TEXT,
        paid_at TEXT,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        description TEXT,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT 'pcs',
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mimetype TEXT,
        size INTEGER,
        uploaded_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rfq_status ON rfqs(status);
      CREATE INDEX IF NOT EXISTS idx_quotation_rfq ON quotations(rfq_id);
      CREATE INDEX IF NOT EXISTS idx_quotation_vendor ON quotations(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_approval_rfq ON approvals(rfq_id);
      CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_po ON invoices(po_id);
      CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
    `);
    console.log('SQLite database initialized successfully');
  }
}

module.exports = { getDB, initDB };
