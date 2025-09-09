-- Add supplier columns to books table in Supabase
ALTER TABLE books 
ADD COLUMN supplier_type TEXT CHECK (supplier_type IN ('government', 'bookshop', 'donors', 'others'));

ALTER TABLE books 
ADD COLUMN supplier_name TEXT;

-- Update existing records to have NULL values (optional - they'll be NULL by default)
-- No need to update existing records as NULL is acceptable

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'books' 
AND column_name IN ('supplier_type', 'supplier_name', 'publisher');
