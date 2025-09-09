-- Migration to add book_id column to book_copies table
-- This will create a proper foreign key relationship between books and book_copies

-- Step 1: Add book_id column to book_copies table
ALTER TABLE book_copies ADD COLUMN book_id TEXT;

-- Step 2: Create an index on the new column for performance
CREATE INDEX idx_book_copies_book_id ON book_copies(book_id);

-- Step 3: Update existing book_copies to link them to books
-- First, try to match by ISBN
UPDATE book_copies 
SET book_id = (
    SELECT b.id 
    FROM books b 
    WHERE b.isbn = book_copies.isbn 
      AND b.isbn IS NOT NULL 
      AND b.isbn != '' 
      AND b.isbn != 'UNKNOWN'
    LIMIT 1
)
WHERE book_id IS NULL;

-- Then, try to match by title and author for remaining unmatched copies
UPDATE book_copies 
SET book_id = (
    SELECT b.id 
    FROM books b 
    WHERE b.title = book_copies.title 
      AND b.author = book_copies.author
    LIMIT 1
)
WHERE book_id IS NULL;

-- Finally, for the special case of sequential legacy_book_ids
-- Match book copies where legacy_book_id is within range of book's legacy_book_id
UPDATE book_copies 
SET book_id = (
    SELECT b.id 
    FROM books b 
    WHERE book_copies.legacy_book_id >= b.legacy_book_id 
      AND book_copies.legacy_book_id < b.legacy_book_id + 100
      AND b.legacy_book_id IS NOT NULL
    LIMIT 1
)
WHERE book_id IS NULL AND legacy_book_id IS NOT NULL;

-- Step 4: Display summary of the migration
SELECT 
    'Total book copies' as description, 
    COUNT(*) as count 
FROM book_copies
UNION ALL
SELECT 
    'Book copies with book_id', 
    COUNT(*) 
FROM book_copies 
WHERE book_id IS NOT NULL
UNION ALL
SELECT 
    'Book copies without book_id', 
    COUNT(*) 
FROM book_copies 
WHERE book_id IS NULL;
