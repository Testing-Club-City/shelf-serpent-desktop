-- SQL commands to fix all book_copies constraints
-- Run these in Supabase SQL Editor

-- 1. Drop the tracking_code unique constraint
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS book_copies_tracking_code_unique;

-- 2. Drop any other unique constraints that might cause issues
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS book_copies_book_id_copy_number_unique;

-- 3. Make tracking_code nullable if it isn't already
ALTER TABLE book_copies 
ALTER COLUMN tracking_code DROP NOT NULL;

-- 4. Check what constraints remain
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'book_copies'::regclass
    AND contype IN ('u', 'f');

-- 5. Check the data type of copy_number (should be integer)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    character_maximum_length,
    numeric_precision
FROM information_schema.columns 
WHERE table_name = 'book_copies'
    AND column_name IN ('copy_number', 'tracking_code', 'book_id')
ORDER BY ordinal_position;