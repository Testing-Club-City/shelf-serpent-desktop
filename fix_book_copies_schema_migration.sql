-- Migration to add missing columns to book_copies table for Supabase sync compatibility

-- Add missing columns that Supabase expects but local schema doesn't have
ALTER TABLE book_copies ADD COLUMN copy_number INTEGER;
ALTER TABLE book_copies ADD COLUMN book_code TEXT;
ALTER TABLE book_copies ADD COLUMN tracking_code TEXT;
ALTER TABLE book_copies ADD COLUMN notes TEXT;

-- Create indexes for the new columns for better performance
CREATE INDEX IF NOT EXISTS idx_book_copies_copy_number ON book_copies(copy_number);
CREATE INDEX IF NOT EXISTS idx_book_copies_book_code ON book_copies(book_code);
CREATE INDEX IF NOT EXISTS idx_book_copies_tracking_code ON book_copies(tracking_code);

-- Update existing records to have default values for the new columns
UPDATE book_copies SET 
    copy_number = CAST(substr(copy_identifier, -3) AS INTEGER) 
    WHERE copy_number IS NULL AND copy_identifier IS NOT NULL;

UPDATE book_copies SET 
    book_code = 'BC-' || CAST(id AS TEXT)
    WHERE book_code IS NULL;

-- Verify the changes
SELECT name FROM pragma_table_info('book_copies') WHERE name IN ('copy_number', 'book_code', 'tracking_code', 'notes');