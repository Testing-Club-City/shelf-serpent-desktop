-- Migration: Update book_copies table to match Supabase schema

-- Drop existing indexes and triggers
DROP TRIGGER IF EXISTS update_book_copies_timestamp;
DROP INDEX IF EXISTS idx_book_copies_book;
DROP INDEX IF EXISTS idx_book_copies_status;
DROP INDEX IF EXISTS idx_book_copies_tracking;
DROP INDEX IF EXISTS idx_book_copies_sync;

-- Rename old table
ALTER TABLE book_copies RENAME TO book_copies_old;

-- Create new table with updated schema
CREATE TABLE book_copies (
    id BIGINT PRIMARY KEY,
    isbn TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    publisher TEXT,
    publication_year INTEGER CHECK (publication_year BETWEEN 1000 AND 2025),
    
    -- Copy-specific details
    copy_identifier TEXT NOT NULL UNIQUE,
    acquisition_date TEXT DEFAULT (date('now')),
    condition TEXT DEFAULT 'good' 
        CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'checked_out', 'lost', 'repair', 'reserved')),
    
    -- Optional tracking fields
    location TEXT,
    department_id INTEGER,
    
    -- Borrowing tracking
    current_borrower_id TEXT,
    borrowed_at TEXT,
    due_date TEXT,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Sync fields
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_book_copies_isbn ON book_copies(isbn);
CREATE INDEX idx_book_copies_borrower ON book_copies(current_borrower_id);
CREATE INDEX idx_book_copies_status ON book_copies(status);
CREATE INDEX idx_book_copies_sync ON book_copies(synced, sync_version);

-- Create trigger for updated_at
CREATE TRIGGER update_book_copies_timestamp
AFTER UPDATE ON book_copies
BEGIN
    UPDATE book_copies SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Data migration - map old fields to new schema
INSERT INTO book_copies (
    id, isbn, title, author, publisher, copy_identifier, 
    condition, status, created_at, updated_at
)
SELECT 
    CAST(COALESCE(legacy_book_id, 0) AS INTEGER) as id,
    COALESCE(book_code, '') as isbn,
    COALESCE(book_code, '') as title,
    COALESCE(book_code, '') as author,
    NULL as publisher,
    COALESCE(tracking_code, '') as copy_identifier,
    CASE condition
        WHEN 'good' THEN 'good'
        WHEN 'fair' THEN 'fair'
        WHEN 'poor' THEN 'poor'
        WHEN 'damaged' THEN 'damaged'
        ELSE 'good'
    END as condition,
    CASE status
        WHEN 'available' THEN 'available'
        WHEN 'borrowed' THEN 'checked_out'
        WHEN 'maintenance' THEN 'repair'
        WHEN 'lost' THEN 'lost'
        WHEN 'stolen' THEN 'lost'
        ELSE 'available'
    END as status,
    COALESCE(created_at, datetime('now')) as created_at,
    COALESCE(updated_at, datetime('now')) as updated_at
FROM book_copies_old;

-- Drop old table
DROP TABLE IF EXISTS book_copies_old;

-- Verify the migration
SELECT name FROM sqlite_master WHERE type='table' AND name='book_copies';
