use rusqlite::Result;
use serde_json::Value;
use std::collections::HashMap;

/// Optimized database queries for better performance
impl super::DatabaseManager {
    /// Get books with categories in a single optimized query
    pub async fn get_books_optimized(&self) -> Result<Vec<Value>> {
        let conn = self.lock_connection()?;
        
        // Single query with LEFT JOIN for better performance
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.author, b.isbn, b.publisher, b.publication_year,
                b.total_copies, b.available_copies, b.shelf_location, b.description,
                b.book_code, b.created_at, b.updated_at,
                c.id as category_id, c.name as category_name
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            WHERE b.deleted = 0 OR b.deleted IS NULL
            ORDER BY b.title
            LIMIT 1000
        ")?;

        let books = stmt.query_map([], |row| {
            let mut book = serde_json::Map::new();
            
            // Book fields
            book.insert("id".to_string(), Value::String(row.get::<_, String>(0)?));
            book.insert("title".to_string(), Value::String(row.get::<_, String>(1)?));
            book.insert("author".to_string(), Value::String(row.get::<_, String>(2)?));
            book.insert("isbn".to_string(), 
                match row.get::<_, Option<String>>(3)? {
                    Some(val) => Value::String(val),
                    None => Value::Null
                });
            book.insert("publisher".to_string(), 
                match row.get::<_, Option<String>>(4)? {
                    Some(val) => Value::String(val),
                    None => Value::Null
                });
            book.insert("publication_year".to_string(), 
                match row.get::<_, Option<i32>>(5)? {
                    Some(val) => Value::Number(serde_json::Number::from(val)),
                    None => Value::Null
                });
            book.insert("total_copies".to_string(), 
                Value::Number(serde_json::Number::from(row.get::<_, i32>(6)?)));
            book.insert("available_copies".to_string(), 
                Value::Number(serde_json::Number::from(row.get::<_, i32>(7)?)));
            book.insert("shelf_location".to_string(), 
                match row.get::<_, Option<String>>(8)? {
                    Some(val) => Value::String(val),
                    None => Value::Null
                });
            book.insert("description".to_string(), 
                match row.get::<_, Option<String>>(9)? {
                    Some(val) => Value::String(val),
                    None => Value::Null
                });
            book.insert("book_code".to_string(), 
                match row.get::<_, Option<String>>(10)? {
                    Some(val) => Value::String(val),
                    None => Value::Null
                });
            book.insert("created_at".to_string(), Value::String(row.get::<_, String>(11)?));
            book.insert("updated_at".to_string(), Value::String(row.get::<_, String>(12)?));
            
            // Category info
            if let Ok(Some(category_id)) = row.get::<_, Option<String>>(13) {
                let mut category = serde_json::Map::new();
                category.insert("id".to_string(), Value::String(category_id));
                if let Ok(Some(category_name)) = row.get::<_, Option<String>>(14) {
                    category.insert("name".to_string(), Value::String(category_name));
                }
                book.insert("categories".to_string(), Value::Object(category));
            }
            
            // Add status based on available copies
            let available = row.get::<_, i32>(7)?;
            let total = row.get::<_, i32>(6)?;
            let status = if available > 0 {
                "available"
            } else if available == 0 && total > 0 {
                "borrowed"
            } else {
                "unavailable"
            };
            book.insert("status".to_string(), Value::String(status.to_string()));
            
            Ok(Value::Object(book))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(books)
    }

    /// Fast book search with indexed queries
    pub async fn search_books_fast(&self, query: &str) -> Result<Vec<Value>> {
        let conn = self.lock_connection()?;
        
        let search_term = format!("%{}%", query.to_lowercase());
        
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.author, b.isbn, b.book_code,
                b.total_copies, b.available_copies,
                c.name as category_name
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            WHERE (b.deleted = 0 OR b.deleted IS NULL)
            AND (
                LOWER(b.title) LIKE ?1 OR 
                LOWER(b.author) LIKE ?1 OR 
                LOWER(b.isbn) LIKE ?1 OR 
                LOWER(b.book_code) LIKE ?1
            )
            ORDER BY 
                CASE 
                    WHEN LOWER(b.title) LIKE ?1 THEN 1
                    WHEN LOWER(b.author) LIKE ?1 THEN 2
                    WHEN LOWER(b.book_code) LIKE ?1 THEN 3
                    ELSE 4
                END,
                b.title
            LIMIT 50
        ")?;

        let books = stmt.query_map([&search_term], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "author": row.get::<_, String>(2)?,
                "isbn": row.get::<_, Option<String>>(3)?,
                "book_code": row.get::<_, Option<String>>(4)?,
                "total_copies": row.get::<_, i32>(5)?,
                "available_copies": row.get::<_, i32>(6)?,
                "category_name": row.get::<_, Option<String>>(7)?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(books)
    }

    /// Get paginated books for better performance
    pub async fn get_books_paginated(&self, page: i32, page_size: i32) -> Result<(Vec<Value>, i32)> {
        let conn = self.lock_connection()?;
        
        // Get total count first
        let total_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM books WHERE deleted = 0 OR deleted IS NULL",
            [],
            |row| row.get(0)
        )?;
        
        let offset = (page - 1) * page_size;
        
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.author, b.isbn, b.publisher,
                b.total_copies, b.available_copies, b.book_code,
                c.name as category_name
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.id
            WHERE b.deleted = 0 OR b.deleted IS NULL
            ORDER BY b.title
            LIMIT ?1 OFFSET ?2
        ")?;

        let books = stmt.query_map([page_size, offset], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "author": row.get::<_, String>(2)?,
                "isbn": row.get::<_, Option<String>>(3)?,
                "publisher": row.get::<_, Option<String>>(4)?,
                "total_copies": row.get::<_, i32>(5)?,
                "available_copies": row.get::<_, i32>(6)?,
                "book_code": row.get::<_, Option<String>>(7)?,
                "category_name": row.get::<_, Option<String>>(8)?,
                "status": if row.get::<_, i32>(6)? > 0 { "available" } else { "borrowed" }
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok((books, total_count))
    }

    /// Batch operations for better performance
    pub async fn get_dashboard_stats_fast(&self) -> Result<HashMap<String, i32>> {
        let conn = self.lock_connection()?;
        
        // Single query for all stats
        let mut stmt = conn.prepare("
            SELECT 
                (SELECT COUNT(*) FROM books WHERE deleted = 0 OR deleted IS NULL) as total_books,
                (SELECT COUNT(*) FROM students WHERE deleted = 0 OR deleted IS NULL) as total_students,
                (SELECT COUNT(*) FROM borrowings WHERE status = 'active') as active_borrowings,
                (SELECT COUNT(*) FROM borrowings WHERE status = 'active' AND due_date < date('now')) as overdue_books,
                (SELECT SUM(available_copies) FROM books WHERE deleted = 0 OR deleted IS NULL) as available_books,
                (SELECT COUNT(*) FROM categories WHERE deleted = 0 OR deleted IS NULL) as total_categories
        ")?;

        let stats = stmt.query_row([], |row| {
            let mut map = HashMap::new();
            map.insert("total_books".to_string(), row.get::<_, i32>(0)?);
            map.insert("total_students".to_string(), row.get::<_, i32>(1)?);
            map.insert("active_borrowings".to_string(), row.get::<_, i32>(2)?);
            map.insert("overdue_books".to_string(), row.get::<_, i32>(3)?);
            map.insert("available_books".to_string(), row.get::<_, i32>(4)?);
            map.insert("total_categories".to_string(), row.get::<_, i32>(5)?);
            Ok(map)
        })?;

        Ok(stats)
    }

    /// Create database indexes for better query performance
    pub async fn create_performance_indexes(&self) -> Result<()> {
        let conn = self.lock_connection()?;
        
        // Create indexes for common queries
        let indexes = [
            "CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)",
            "CREATE INDEX IF NOT EXISTS idx_books_author ON books(author)",
            "CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)",
            "CREATE INDEX IF NOT EXISTS idx_books_code ON books(book_code)",
            "CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id)",
            "CREATE INDEX IF NOT EXISTS idx_books_available ON books(available_copies)",
            "CREATE INDEX IF NOT EXISTS idx_books_deleted ON books(deleted)",
            "CREATE INDEX IF NOT EXISTS idx_students_admission ON students(admission_number)",
            "CREATE INDEX IF NOT EXISTS idx_students_name ON students(first_name, last_name)",
            "CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status)",
            "CREATE INDEX IF NOT EXISTS idx_borrowings_due ON borrowings(due_date)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_tracking ON book_copies(tracking_code)",
        ];

        for index_sql in &indexes {
            if let Err(e) = conn.execute(index_sql, []) {
                eprintln!("Warning: Failed to create index: {} - {}", index_sql, e);
            }
        }

        println!("✅ Performance indexes created successfully");
        Ok(())
    }
}