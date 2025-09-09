-- Add missing tables that exist in Supabase but not in local schema

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- School Terms Table
CREATE TABLE IF NOT EXISTS school_terms (
    id TEXT PRIMARY KEY,
    term_name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);