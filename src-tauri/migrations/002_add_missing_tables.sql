-- Add missing tables for sync functionality
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    suspended INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 0,
    last_seen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    description TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);