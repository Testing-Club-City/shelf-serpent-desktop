-- SQL commands to remove ALL unique constraints from book_copies table
-- Run these in Supabase SQL Editor

-- 1. Drop the unique_tracking_code constraint
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS unique_tracking_code;

-- 2. Drop any other tracking code constraints
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS book_copies_tracking_code_unique;

-- 3. Drop book_id + copy_number constraint
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS book_copies_book_id_copy_number_unique;

-- 4. Drop any other unique constraints that might exist
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS book_copies_unique_when_not_null;

-- 5. List all remaining constraints to see what's left
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'book_copies'::regclass
    AND contype IN ('u', 'f', 'p');

-- 6. If there are still unique constraints, we can find and drop them all
-- This query will generate DROP statements for any remaining unique constraints
SELECT 
    'ALTER TABLE book_copies DROP CONSTRAINT IF EXISTS ' || conname || ';' as drop_statement
FROM pg_constraint 
WHERE conrelid = 'book_copies'::regclass
    AND contype = 'u';

-- 7. Make sure all problematic columns are nullable
ALTER TABLE book_copies 
ALTER COLUMN tracking_code DROP NOT NULL;

ALTER TABLE book_copies 
ALTER COLUMN copy_number DROP NOT NULL;

ALTER TABLE book_copies 
ALTER COLUMN book_id DROP NOT NULL;

-- 8. Final check - show table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'book_copies'
    AND column_name IN ('id', 'book_id', 'copy_number', 'tracking_code')
ORDER BY ordinal_position;