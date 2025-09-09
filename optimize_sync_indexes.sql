-- Optimize sync performance with better indexes
CREATE INDEX IF NOT EXISTS idx_categories_synced_fast ON categories(synced, id) WHERE synced = 0 OR synced IS NULL;
CREATE INDEX IF NOT EXISTS idx_books_synced_fast ON books(synced, id) WHERE synced = 0 OR synced IS NULL;
CREATE INDEX IF NOT EXISTS idx_book_copies_synced_fast ON book_copies(synced, id) WHERE synced = 0 OR synced IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_synced_fast ON students(synced, id) WHERE synced = 0 OR synced IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_synced_fast ON staff(synced, id) WHERE synced = 0 OR synced IS NULL;
CREATE INDEX IF NOT EXISTS idx_borrowings_synced_fast ON borrowings(synced, id) WHERE synced = 0 OR synced IS NULL;
CREATE INDEX IF NOT EXISTS idx_fines_synced_fast ON fines(synced, id) WHERE synced = 0 OR synced IS NULL;

-- Analyze tables to update statistics
ANALYZE;