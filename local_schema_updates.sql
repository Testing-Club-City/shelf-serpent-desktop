-- Local SQLite Schema Updates to Match New Supabase Schema
-- Run this on your local SQLite database

-- 1. Add missing 'synced' columns to all tables (essential for bidirectional sync)
ALTER TABLE categories ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE classes ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE borrowings ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE book_copies ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE fines ADD COLUMN synced INTEGER DEFAULT 0;
ALTER TABLE fine_settings ADD COLUMN synced INTEGER DEFAULT 0;

-- 2. Add missing columns to borrowings table to match Supabase
ALTER TABLE borrowings ADD COLUMN issued_by TEXT;
ALTER TABLE borrowings ADD COLUMN returned_by TEXT;
ALTER TABLE borrowings ADD COLUMN fine_paid INTEGER DEFAULT 0;
ALTER TABLE borrowings ADD COLUMN book_copy_id TEXT;
ALTER TABLE borrowings ADD COLUMN condition_at_issue TEXT DEFAULT 'good';
ALTER TABLE borrowings ADD COLUMN condition_at_return TEXT;
ALTER TABLE borrowings ADD COLUMN is_lost INTEGER DEFAULT 0;
ALTER TABLE borrowings ADD COLUMN tracking_code TEXT;
ALTER TABLE borrowings ADD COLUMN return_notes TEXT;
ALTER TABLE borrowings ADD COLUMN copy_condition TEXT;
ALTER TABLE borrowings ADD COLUMN group_borrowing_id TEXT;
ALTER TABLE borrowings ADD COLUMN borrower_type TEXT DEFAULT 'student';
ALTER TABLE borrowings ADD COLUMN staff_id TEXT;

-- 3. Add missing columns to books table
ALTER TABLE books ADD COLUMN legacy_book_id INTEGER;
ALTER TABLE books ADD COLUMN legacy_isbn TEXT;
ALTER TABLE books ADD COLUMN acquisition_year INTEGER DEFAULT 2024;

-- 4. Add missing columns to book_copies table
ALTER TABLE book_copies ADD COLUMN book_code TEXT;
ALTER TABLE book_copies ADD COLUMN legacy_book_id INTEGER;
ALTER TABLE book_copies ADD COLUMN synced INTEGER DEFAULT 0;

-- 5. Add missing columns to students table
ALTER TABLE students ADD COLUMN academic_year TEXT DEFAULT '2024/2025';
ALTER TABLE students ADD COLUMN is_repeating INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN legacy_student_id INTEGER;

-- 6. Add missing columns to fines table
ALTER TABLE fines ADD COLUMN created_by TEXT;
ALTER TABLE fines ADD COLUMN borrower_type TEXT DEFAULT 'student';
ALTER TABLE fines ADD COLUMN staff_id TEXT;

-- 7. Add missing columns to staff table (if it exists)
ALTER TABLE staff ADD COLUMN legacy_staff_id INTEGER;
ALTER TABLE staff ADD COLUMN synced INTEGER DEFAULT 0;

-- 8. Create new tables if they don't exist

-- Group Borrowings Table
CREATE TABLE IF NOT EXISTS group_borrowings (
    id TEXT PRIMARY KEY,
    book_id TEXT,
    book_copy_id TEXT,
    tracking_code TEXT,
    borrowed_date TEXT,
    due_date TEXT,
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
    created_at TEXT,
    updated_at TEXT,
    student_ids TEXT, -- JSON array as text in SQLite
    synced INTEGER DEFAULT 0
);

-- Theft Reports Table
CREATE TABLE IF NOT EXISTS theft_reports (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    book_id TEXT,
    book_copy_id TEXT,
    borrowing_id TEXT,
    expected_tracking_code TEXT,
    returned_tracking_code TEXT,
    theft_reason TEXT,
    reported_date TEXT,
    reported_by TEXT,
    status TEXT DEFAULT 'reported',
    investigation_notes TEXT,
    resolved_date TEXT,
    resolved_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    synced INTEGER DEFAULT 0
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'info',
    created_at TEXT,
    read INTEGER DEFAULT 0,
    related_id TEXT,
    synced INTEGER DEFAULT 0
);

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'user',
    created_at TEXT,
    updated_at TEXT,
    suspended INTEGER DEFAULT 0,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    is_online INTEGER DEFAULT 0,
    last_seen TEXT,
    synced INTEGER DEFAULT 0
);

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_borrowings_student_id ON borrowings(student_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_id ON borrowings(book_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy_id ON borrowings(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status);
CREATE INDEX IF NOT EXISTS idx_borrowings_synced ON borrowings(synced);

CREATE INDEX IF NOT EXISTS idx_books_synced ON books(synced);
CREATE INDEX IF NOT EXISTS idx_students_synced ON students(synced);
CREATE INDEX IF NOT EXISTS idx_categories_synced ON categories(synced);
CREATE INDEX IF NOT EXISTS idx_classes_synced ON classes(synced);

-- 10. Update existing data to set proper defaults
UPDATE borrowings SET fine_paid = 0 WHERE fine_paid IS NULL;
UPDATE borrowings SET is_lost = 0 WHERE is_lost IS NULL;
UPDATE borrowings SET borrower_type = 'student' WHERE borrower_type IS NULL;
UPDATE borrowings SET condition_at_issue = 'good' WHERE condition_at_issue IS NULL;

UPDATE books SET acquisition_year = 2024 WHERE acquisition_year IS NULL;
UPDATE students SET academic_year = '2024/2025' WHERE academic_year IS NULL;
UPDATE students SET is_repeating = 0 WHERE is_repeating IS NULL;

UPDATE fines SET borrower_type = 'student' WHERE borrower_type IS NULL;
