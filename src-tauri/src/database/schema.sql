-- Library Management System Local Database Schema
-- SQLite version compatible with Supabase PostgreSQL schema

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Books Table
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    genre TEXT,
    publisher TEXT,
    publication_year INTEGER,
    total_copies INTEGER DEFAULT 1 NOT NULL,
    available_copies INTEGER DEFAULT 1 NOT NULL,
    shelf_location TEXT,
    cover_image_url TEXT,
    description TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'damaged', 'lost')),
    category_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'damaged', 'lost', 'stolen')),
    book_code TEXT UNIQUE,
    acquisition_year INTEGER DEFAULT 2024,
    legacy_book_id INTEGER UNIQUE,
    legacy_isbn TEXT,
    supplier_type TEXT CHECK (supplier_type IN ('government', 'bookshop', 'donors', 'others')),
    supplier_name TEXT,
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS book_copies (
    id BIGINT PRIMARY KEY,
    book_id TEXT, -- Foreign key to books table
    isbn TEXT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    publisher TEXT,
    publication_year INTEGER,
    
    -- Copy-specific details
    copy_identifier TEXT NOT NULL UNIQUE,
    copy_number INTEGER,
    book_code TEXT,
    tracking_code TEXT,
    notes TEXT,
    acquisition_date TEXT DEFAULT (date('now')),
    condition TEXT 
        CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
    status TEXT NOT NULL 
        CHECK (status IN ('available', 'checked_out', 'lost', 'repair', 'reserved')),
    
    -- Optional tracking fields
    location TEXT,
    department_id INTEGER,
    
    -- Borrowing tracking
    current_borrower_id TEXT,
    borrowed_at TEXT,
    due_date TEXT,
    
    -- Legacy mapping
    legacy_book_id INTEGER,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Sync fields
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    class_name TEXT NOT NULL UNIQUE,
    form_level INTEGER NOT NULL,
    class_section TEXT,
    max_books_allowed INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    academic_level_type TEXT DEFAULT 'form' CHECK (academic_level_type IN ('form', 'grade')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    admission_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    class_grade TEXT NOT NULL,
    address TEXT,
    date_of_birth TEXT,
    enrollment_date TEXT DEFAULT (date('now')),
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    class_id TEXT,
    academic_year TEXT DEFAULT '2024/2025',
    is_repeating INTEGER DEFAULT 0,
    legacy_student_id INTEGER UNIQUE,
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL UNIQUE,
    staff_number TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT,
    position TEXT,
    hire_date TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    legacy_staff_id INTEGER UNIQUE,
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Borrowings Table
CREATE TABLE IF NOT EXISTS borrowings (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    book_id TEXT,
    borrowed_date TEXT DEFAULT (date('now')),
    due_date TEXT NOT NULL,
    returned_date TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
    fine_amount REAL DEFAULT 0,
    notes TEXT,
    issued_by TEXT,
    returned_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    fine_paid INTEGER DEFAULT 0,
    book_copy_id TEXT,
    condition_at_issue TEXT DEFAULT 'good',
    condition_at_return TEXT,
    is_lost INTEGER DEFAULT 0,
    tracking_code TEXT,
    return_notes TEXT,
    copy_condition TEXT,
    group_borrowing_id TEXT,
    borrower_type TEXT DEFAULT 'student' CHECK (borrower_type IN ('student', 'staff')),
    staff_id TEXT,
    borrowing_type TEXT,
    long_term_period TEXT,
    short_term_period TEXT,
    is_long_term INTEGER DEFAULT 0,
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Group Borrowings Table
CREATE TABLE IF NOT EXISTS group_borrowings (
    id TEXT PRIMARY KEY,
    book_id TEXT,
    book_copy_id TEXT,
    tracking_code TEXT,
    borrowed_date TEXT DEFAULT (date('now')),
    due_date TEXT NOT NULL,
    returned_date TEXT,
    condition_at_issue TEXT DEFAULT 'good',
    condition_at_return TEXT,
    fine_amount REAL DEFAULT 0,
    fine_paid INTEGER DEFAULT 0,
    notes TEXT,
    return_notes TEXT,
    status TEXT DEFAULT 'active',
    is_lost INTEGER DEFAULT 0,
    student_count INTEGER DEFAULT 1,
    issued_by TEXT,
    returned_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    student_ids TEXT DEFAULT '[]', -- JSON array as text
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Fines Table
CREATE TABLE IF NOT EXISTS fines (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    borrowing_id TEXT,
    fine_type TEXT NOT NULL CHECK (fine_type IN ('overdue', 'damaged', 'lost', 'lost_book', 'late_return', 'damage')),
    amount REAL DEFAULT 0 NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cleared', 'collected', 'partial', 'waived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT,
    borrower_type TEXT DEFAULT 'student' CHECK (borrower_type IN ('student', 'staff')),
    staff_id TEXT,
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Fine Settings Table
CREATE TABLE IF NOT EXISTS fine_settings (
    id TEXT PRIMARY KEY,
    fine_type TEXT NOT NULL UNIQUE CHECK (fine_type IN ('overdue', 'damaged', 'lost_book', 'stolen_book', 'theft_victim', 'condition_poor', 'condition_fair', 'condition_excellent', 'condition_good', 'late_return', 'replacement_cost', 'processing_fee')),
    amount REAL DEFAULT 0 NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Theft Reports Table
CREATE TABLE IF NOT EXISTS theft_reports (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    book_id TEXT,
    book_copy_id TEXT,
    borrowing_id TEXT,
    expected_tracking_code TEXT NOT NULL,
    returned_tracking_code TEXT NOT NULL,
    theft_reason TEXT,
    reported_date TEXT DEFAULT (date('now')),
    reported_by TEXT,
    status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')),
    investigation_notes TEXT,
    resolved_date TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- User Sessions Table for Offline Authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TEXT NOT NULL,
    user_metadata TEXT, -- JSON blob for user profile data
    role TEXT DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity TEXT NOT NULL DEFAULT (datetime('now')),
    session_valid INTEGER DEFAULT 1, -- 0 = invalid, 1 = valid
    offline_expiry TEXT NOT NULL, -- Extended expiry for offline use
    device_fingerprint TEXT
);

-- Sync Management Tables
CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    payload TEXT -- JSON payload for the operation
);

CREATE TABLE IF NOT EXISTS sync_state (
    table_name TEXT PRIMARY KEY,
    last_sync TEXT NOT NULL DEFAULT (datetime('now')),
    sync_token TEXT,
    total_records INTEGER DEFAULT 0,
    synced_records INTEGER DEFAULT 0
);

-- Conflict Resolution Table
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    local_data TEXT NOT NULL, -- JSON
    remote_data TEXT NOT NULL, -- JSON
    conflict_type TEXT NOT NULL, -- 'update_conflict', 'delete_conflict'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved INTEGER DEFAULT 0,
    resolution_strategy TEXT -- 'local_wins', 'remote_wins', 'manual'
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_sync ON books(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);
-- CREATE INDEX IF NOT EXISTS idx_book_copies_copy_identifier ON book_copies(copy_identifier);
CREATE INDEX IF NOT EXISTS idx_book_copies_sync ON book_copies(synced, sync_version);
CREATE INDEX IF NOT EXISTS idx_book_copies_isbn ON book_copies(isbn);
CREATE INDEX IF NOT EXISTS idx_book_copies_current_borrower ON book_copies(current_borrower_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_legacy_book_id ON book_copies(legacy_book_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_title ON book_copies(title);
CREATE INDEX IF NOT EXISTS idx_book_copies_author ON book_copies(author);
CREATE INDEX IF NOT EXISTS idx_book_copies_copy_number ON book_copies(copy_number);
CREATE INDEX IF NOT EXISTS idx_book_copies_book_code ON book_copies(book_code);
CREATE INDEX IF NOT EXISTS idx_book_copies_tracking_code ON book_copies(tracking_code);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_admission ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_sync ON students(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(class_name);
CREATE INDEX IF NOT EXISTS idx_classes_sync ON classes(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_staff_sync ON staff(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_borrowings_student ON borrowings(student_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status);
CREATE INDEX IF NOT EXISTS idx_borrowings_dates ON borrowings(borrowed_date, due_date);
CREATE INDEX IF NOT EXISTS idx_borrowings_sync ON borrowings(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_fines_student ON fines(student_id);
CREATE INDEX IF NOT EXISTS idx_fines_borrowing ON fines(borrowing_id);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_fines_sync ON fines(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_group_borrowings_book ON group_borrowings(book_id);
CREATE INDEX IF NOT EXISTS idx_group_borrowings_status ON group_borrowings(status);
CREATE INDEX IF NOT EXISTS idx_group_borrowings_sync ON group_borrowings(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_theft_reports_student ON theft_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_theft_reports_book ON theft_reports(book_id);
CREATE INDEX IF NOT EXISTS idx_theft_reports_status ON theft_reports(status);
CREATE INDEX IF NOT EXISTS idx_theft_reports_sync ON theft_reports(synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_sync_log_table ON sync_log(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_log_synced ON sync_log(synced);
CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);

-- User Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_offline_expiry ON user_sessions(offline_expiry);
CREATE INDEX IF NOT EXISTS idx_user_sessions_valid ON user_sessions(session_valid);

-- Triggers for automatic updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_categories_timestamp 
    AFTER UPDATE ON categories 
    BEGIN 
        UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_books_timestamp 
    AFTER UPDATE ON books 
    BEGIN 
        UPDATE books SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_book_copies_timestamp 
    AFTER UPDATE ON book_copies 
    BEGIN 
        UPDATE book_copies SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_students_timestamp 
    AFTER UPDATE ON students 
    BEGIN 
        UPDATE students SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_borrowings_timestamp 
    AFTER UPDATE ON borrowings 
    BEGIN 
        UPDATE borrowings SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_group_borrowings_timestamp 
    AFTER UPDATE ON group_borrowings 
    BEGIN 
        UPDATE group_borrowings SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_theft_reports_timestamp 
    AFTER UPDATE ON theft_reports 
    BEGIN 
        UPDATE theft_reports SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- Sync tracking triggers
CREATE TRIGGER IF NOT EXISTS sync_track_categories_insert
    AFTER INSERT ON categories
    BEGIN
        INSERT INTO sync_log (id, table_name, record_id, operation, payload)
        VALUES (
            lower(hex(randomblob(16))),
            'categories',
            NEW.id,
            'insert',
            json_object(
                'id', NEW.id,
                'name', NEW.name,
                'description', NEW.description,
                'created_at', NEW.created_at,
                'updated_at', NEW.updated_at
            )
        );
    END;

CREATE TRIGGER IF NOT EXISTS sync_track_categories_update
    AFTER UPDATE ON categories
    BEGIN
        INSERT INTO sync_log (id, table_name, record_id, operation, payload)
        VALUES (
            lower(hex(randomblob(16))),
            'categories',
            NEW.id,
            'update',
            json_object(
                'id', NEW.id,
                'name', NEW.name,
                'description', NEW.description,
                'created_at', NEW.created_at,
                'updated_at', NEW.updated_at
            )
        );
    END;

-- Views for efficient querying
CREATE VIEW IF NOT EXISTS books_with_details AS
SELECT 
    b.*,
    c.name as category_name,
    c.description as category_description,
    COUNT(bc.id) as total_physical_copies,
    COUNT(CASE WHEN bc.status = 'available' THEN 1 END) as available_physical_copies,
    COUNT(CASE WHEN br.status = 'active' THEN 1 END) as current_borrowings
FROM books b
LEFT JOIN categories c ON b.category_id = c.id
LEFT JOIN book_copies bc ON b.isbn = bc.isbn AND bc.deleted = 0
LEFT JOIN borrowings br ON b.id = br.book_id AND br.status = 'active' AND br.deleted = 0
WHERE b.deleted = 0
GROUP BY b.id;

CREATE VIEW IF NOT EXISTS students_with_borrowings AS
SELECT 
    s.*,
    cl.class_name,
    cl.form_level,
    COUNT(br.id) as active_borrowings_count,
    COALESCE(SUM(f.amount), 0) as total_unpaid_fines
FROM students s
LEFT JOIN classes cl ON s.class_id = cl.id
LEFT JOIN borrowings br ON s.id = br.student_id AND br.status = 'active' AND br.deleted = 0
LEFT JOIN fines f ON s.id = f.student_id AND f.status IN ('unpaid', 'partial') AND f.deleted = 0
WHERE s.deleted = 0
GROUP BY s.id;

CREATE VIEW IF NOT EXISTS overdue_borrowings AS
SELECT 
    br.*,
    b.title as book_title,
    b.author as book_author,
    s.first_name as student_first_name,
    s.last_name as student_last_name,
    s.admission_number,
    cl.class_name,
    CAST(julianday('now') - julianday(br.due_date) AS INTEGER) as days_overdue
FROM borrowings br
JOIN books b ON br.book_id = b.id
LEFT JOIN students s ON br.student_id = s.id
LEFT JOIN classes cl ON s.class_id = cl.id
WHERE br.status = 'active' 
    AND br.due_date < date('now')
    AND br.deleted = 0
    AND b.deleted = 0;

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'user',
    suspended INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 0,
    last_seen TEXT,
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
    updated_by TEXT,
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

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    level TEXT NOT NULL CHECK (level IN ('trace', 'debug', 'info', 'warn', 'error', 'critical')),
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    user_id TEXT,
    user_email TEXT,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON string
    duration_ms INTEGER,
    error_message TEXT,
    stack_trace TEXT,
    source_file TEXT,
    source_line INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);

-- Initialize sync state for all tables
INSERT OR IGNORE INTO sync_state (table_name, last_sync, total_records, synced_records) VALUES
('categories', datetime('1970-01-01'), 0, 0),
('books', datetime('1970-01-01'), 0, 0),
('book_copies', datetime('1970-01-01'), 0, 0),
('classes', datetime('1970-01-01'), 0, 0),
('students', datetime('1970-01-01'), 0, 0),
('staff', datetime('1970-01-01'), 0, 0),
('borrowings', datetime('1970-01-01'), 0, 0),
('group_borrowings', datetime('1970-01-01'), 0, 0),
('fines', datetime('1970-01-01'), 0, 0),
('fine_settings', datetime('1970-01-01'), 0, 0),
('theft_reports', datetime('1970-01-01'), 0, 0),
('profiles', datetime('1970-01-01'), 0, 0),
('system_settings', datetime('1970-01-01'), 0, 0),
('school_terms', datetime('1970-01-01'), 0, 0),
('activity_logs', datetime('1970-01-01'), 0, 0);
