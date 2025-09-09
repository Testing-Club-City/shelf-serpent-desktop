-- Debug query to check borrowing data
SELECT 
    b.id as borrowing_id,
    b.book_id,
    b.book_copy_id,
    b.tracking_code,
    s.first_name || ' ' || s.last_name as student_name,
    bk.title as book_title,
    bk.author as book_author,
    bc.title as copy_title,
    bc.author as copy_author
FROM borrowings b
LEFT JOIN students s ON b.student_id = s.id
LEFT JOIN books bk ON b.book_id = bk.id
LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
WHERE s.first_name IN ('CHRISTIAN', 'BRIAN')
ORDER BY b.created_at DESC;

-- Check if book_copies table has the book information
SELECT 
    id,
    title,
    author,
    isbn,
    legacy_book_id,
    status
FROM book_copies 
WHERE title IS NOT NULL AND title != 'Unknown Title'
LIMIT 10;

-- Check books table
SELECT 
    id,
    title,
    author,
    isbn
FROM books
LIMIT 10;