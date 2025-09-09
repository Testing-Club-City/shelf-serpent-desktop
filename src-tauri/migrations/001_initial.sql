-- Initial migration for local SQLite database
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY,
    last_sync_timestamp INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
);
