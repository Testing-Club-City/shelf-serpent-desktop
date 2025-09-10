-- SQL commands to fix book_copies unique constraint issues
-- Run these in Supabase SQL Editor

-- 1. Check the current unique constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name = 'book_copies';

-- 2. Drop the unique constraint that's causing issues
ALTER TABLE book_copies 
DROP CONSTRAINT IF EXISTS book_copies_book_id_copy_number_unique;

-- 3. Alternative: If you want to keep some uniqueness, create a different constraint
-- that allows NULL values (which won't conflict)
-- ALTER TABLE book_copies 
-- ADD CONSTRAINT book_copies_unique_when_not_null 
-- UNIQUE (book_id, copy_number) DEFERRABLE INITIALLY DEFERRED;

-- 4. Check if there are any other unique constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'book_copies'::regclass
    AND contype = 'u';

-- 5. Make sure copy_number can be NULL (should already be done)
ALTER TABLE book_copies 
ALTER COLUMN copy_number DROP NOT NULL;

-- 6. Check the table structure after changes
SELECT 
    column_name, 
    is_nullable, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'book_copies'
    AND column_name IN ('book_id', 'copy_number', 'id')
ORDER BY ordinal_position;