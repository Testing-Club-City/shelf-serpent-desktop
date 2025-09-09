-- Add indexes to speed up UPDATE queries
CREATE INDEX IF NOT EXISTS idx_categories_id ON categories(id);
CREATE INDEX IF NOT EXISTS idx_books_id ON books(id);
CREATE INDEX IF NOT EXISTS idx_book_copies_id ON book_copies(id);
CREATE INDEX IF NOT EXISTS idx_students_id ON students(id);
CREATE INDEX IF NOT EXISTS idx_staff_id ON staff(id);
CREATE INDEX IF NOT EXISTS idx_borrowings_id ON borrowings(id);
CREATE INDEX IF NOT EXISTS idx_fines_id ON fines(id);

-- Optimize database
PRAGMA optimize;