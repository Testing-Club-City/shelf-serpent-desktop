-- SQL commands to fix Supabase table constraints
-- Run these in Supabase SQL Editor to allow NULL values and fix foreign key issues

-- 1. Make book_copy_id nullable in borrowings table (main issue from sync errors)
ALTER TABLE borrowings 
ALTER COLUMN book_copy_id DROP NOT NULL;

-- 2. Make student_id nullable in borrowings table (in case some borrowings are for staff)
ALTER TABLE borrowings 
ALTER COLUMN student_id DROP NOT NULL;

-- 3. Make staff_id nullable in borrowings table (in case some borrowings are for students)
ALTER TABLE borrowings 
ALTER COLUMN staff_id DROP NOT NULL;

-- 4. Make other potentially problematic columns nullable in borrowings
ALTER TABLE borrowings 
ALTER COLUMN borrowed_date DROP NOT NULL;

ALTER TABLE borrowings 
ALTER COLUMN due_date DROP NOT NULL;

-- 5. Make book_id nullable in book_copies table (some copies might not have book references)
ALTER TABLE book_copies 
ALTER COLUMN book_id DROP NOT NULL;

-- 6. Make other potentially problematic columns nullable in book_copies
ALTER TABLE book_copies 
ALTER COLUMN copy_number DROP NOT NULL;

ALTER TABLE book_copies 
ALTER COLUMN department_id DROP NOT NULL;

-- 7. Check current constraints (run this to see what constraints exist)
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('borrowings', 'book_copies');

-- 8. If needed, temporarily disable foreign key constraints during sync
-- (Use with caution - only if above changes don't work)
-- SET session_replication_role = replica;  -- Disables triggers and constraints
-- 
-- After sync, re-enable with:
-- SET session_replication_role = DEFAULT;

-- 9. Alternative: Drop and recreate foreign key constraints with ON DELETE SET NULL
-- (Only run if you want to completely remove the constraint requirement)

-- Drop existing foreign key constraint for book_copy_id (if it exists)
-- ALTER TABLE borrowings DROP CONSTRAINT IF EXISTS borrowings_book_copy_id_fkey;

-- Recreate with ON DELETE SET NULL to allow orphaned records
-- ALTER TABLE borrowings 
-- ADD CONSTRAINT borrowings_book_copy_id_fkey 
-- FOREIGN KEY (book_copy_id) 
-- REFERENCES book_copies(id) 
-- ON DELETE SET NULL;

-- 10. Check table structure after changes
SELECT 
    column_name, 
    is_nullable, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name IN ('borrowings', 'book_copies')
ORDER BY table_name, ordinal_position;