import Database from "better-sqlite3";
import path from "path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.SPRATOR_DB_PATH || path.join(process.cwd(), "sprator.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      stripe_sub_id TEXT,
      name TEXT NOT NULL,
      monthly_cost REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_used TEXT,
      agent_flag TEXT,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS failed_payments (
      id TEXT PRIMARY KEY,
      stripe_invoice_id TEXT,
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL,
      attempt INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending_dunning',
      agent_action TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      reason TEXT NOT NULL,
      impact TEXT NOT NULL,
      savings_monthly REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT,
      decided_at TEXT,
      decided_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      amount REAL,
      stripe_ref TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      category TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_feed (
      id TEXT PRIMARY KEY,
      icon TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
