-- Supabase Schema Updates and Optimizations
-- Run this on your Supabase database

-- 1. Ensure enum types exist (run these first)
DO $$ BEGIN
    CREATE TYPE book_status AS ENUM (
        'available',
        'unavailable', 
        'damaged',
        'lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE borrowing_status AS ENUM (
        'active',
        'returned',
        'overdue', 
        'lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add missing indexes for better sync performance
CREATE INDEX IF NOT EXISTS idx_books_synced ON books(updated_at);
CREATE INDEX IF NOT EXISTS idx_students_synced ON students(updated_at);
CREATE INDEX IF NOT EXISTS idx_borrowings_synced ON borrowings(updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_synced ON categories(updated_at);
CREATE INDEX IF NOT EXISTS idx_classes_synced ON classes(updated_at);
CREATE INDEX IF NOT EXISTS idx_book_copies_synced ON book_copies(updated_at);
CREATE INDEX IF NOT EXISTS idx_staff_synced ON staff(updated_at);
CREATE INDEX IF NOT EXISTS idx_fines_synced ON fines(updated_at);

-- 3. Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_borrowings_student_status ON borrowings(student_id, status);
CREATE INDEX IF NOT EXISTS idx_borrowings_book_status ON borrowings(book_id, status);
CREATE INDEX IF NOT EXISTS idx_borrowings_dates ON borrowings(borrowed_date, due_date);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- 4. Add unique constraints if missing
ALTER TABLE books ADD CONSTRAINT unique_isbn UNIQUE (isbn);
ALTER TABLE books ADD CONSTRAINT unique_book_code UNIQUE (book_code);
ALTER TABLE book_copies ADD CONSTRAINT unique_tracking_code UNIQUE (tracking_code);
ALTER TABLE students ADD CONSTRAINT unique_admission_number UNIQUE (admission_number);
ALTER TABLE staff ADD CONSTRAINT unique_staff_id UNIQUE (staff_id);
ALTER TABLE categories ADD CONSTRAINT unique_category_name UNIQUE (name);
ALTER TABLE classes ADD CONSTRAINT unique_class_name UNIQUE (class_name);

-- 5. Add check constraints for data integrity
ALTER TABLE borrowings ADD CONSTRAINT check_borrowing_dates 
    CHECK (due_date >= borrowed_date);

ALTER TABLE borrowings ADD CONSTRAINT check_return_dates 
    CHECK (returned_date IS NULL OR returned_date >= borrowed_date);

ALTER TABLE books ADD CONSTRAINT check_copies 
    CHECK (available_copies <= total_copies AND available_copies >= 0);

ALTER TABLE books ADD CONSTRAINT check_publication_year 
    CHECK (publication_year IS NULL OR publication_year > 1000);

-- 6. Set up Row Level Security (RLS) policies
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE theft_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 7. Create policies for authenticated users (adjust as needed)
CREATE POLICY "Allow authenticated users to read books" ON books
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert books" ON books
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update books" ON books
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Repeat similar policies for other tables
CREATE POLICY "Allow authenticated users full access to students" ON students
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users full access to borrowings" ON borrowings
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users full access to categories" ON categories
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users full access to classes" ON classes
    FOR ALL USING (auth.role() = 'authenticated');

-- 8. Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_borrowings_updated_at BEFORE UPDATE ON borrowings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Create functions for common operations
CREATE OR REPLACE FUNCTION get_overdue_borrowings()
RETURNS TABLE (
    borrowing_id UUID,
    student_name TEXT,
    book_title TEXT,
    days_overdue INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        CONCAT(s.first_name, ' ', s.last_name),
        bk.title,
        (CURRENT_DATE - b.due_date)::INTEGER
    FROM borrowings b
    JOIN students s ON b.student_id = s.id
    JOIN books bk ON b.book_id = bk.id
    WHERE b.status = 'overdue' OR (b.status = 'active' AND b.due_date < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 10. Create view for sync monitoring
CREATE OR REPLACE VIEW sync_status AS
SELECT 
    'books' as table_name,
    COUNT(*) as total_records,
    MAX(updated_at) as last_updated
FROM books
UNION ALL
SELECT 
    'students' as table_name,
    COUNT(*) as total_records,
    MAX(updated_at) as last_updated
FROM students
UNION ALL
SELECT 
    'borrowings' as table_name,
    COUNT(*) as total_records,
    MAX(updated_at) as last_updated
FROM borrowings
UNION ALL
SELECT 
    'categories' as table_name,
    COUNT(*) as total_records,
    MAX(updated_at) as last_updated
FROM categories
UNION ALL
SELECT 
    'classes' as table_name,
    COUNT(*) as total_records,
    MAX(updated_at) as last_updated
FROM classes;
