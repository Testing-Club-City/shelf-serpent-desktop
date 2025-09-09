-- Check if book copy creation is working properly
SELECT 
    COUNT(*) as total_copies,
    COUNT(CASE WHEN created_at > datetime('now', '-1 hour') THEN 1 END) as recent_copies,
    MAX(created_at) as last_created
FROM book_copies;
