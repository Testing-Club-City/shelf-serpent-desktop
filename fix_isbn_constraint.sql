-- Fix ISBN unique constraint to allow multiple NULL values
-- Drop the existing unique constraint on ISBN
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_isbn_key;

-- Create a partial unique index that allows multiple NULL values
CREATE UNIQUE INDEX books_isbn_unique_idx ON books (isbn) WHERE isbn IS NOT NULL;