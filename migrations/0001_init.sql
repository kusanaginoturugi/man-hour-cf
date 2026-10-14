-- 日時はすべて Asia/Tokyo のローカル時刻を 'YYYY-MM-DD HH:MM' の文字列で持つ
-- user_id は Cloudflare Access (authentik) が返すメールアドレス

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  short_name TEXT NOT NULL,
  name TEXT,
  post TEXT,
  address1 TEXT,
  address2 TEXT,
  rep TEXT,
  monthly_budget_hours REAL NOT NULL DEFAULT 18,
  opening_carryover REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_customers_user ON customers (user_id);

CREATE TABLE job_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_job_types_user ON job_types (user_id);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  job_type_id INTEGER NOT NULL REFERENCES job_types (id),
  title TEXT,
  detail TEXT,
  begin_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  work_minutes INTEGER NOT NULL DEFAULT 0,
  outside_budget INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jobs_user_customer_begin ON jobs (user_id, customer_id, begin_date);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  selected_customer_id INTEGER,
  company_name TEXT
);
