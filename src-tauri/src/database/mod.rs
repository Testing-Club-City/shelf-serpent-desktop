use crate::models::*;
use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc, NaiveDateTime};
use tracing::info;

pub mod optimized;
pub mod multithreaded;
pub mod windows_fixes;

pub use multithreaded::MultithreadedDatabaseManager;

// Helper function to parse datetime from SQLite format
fn parse_sqlite_datetime(datetime_str: &str) -> Result<DateTime<Utc>, rusqlite::Error> {
    // Try RFC3339 format first (for new data)
    if let Ok(dt) = DateTime::parse_from_rfc3339(datetime_str) {
        return Ok(dt.with_timezone(&Utc));
    }
    
    // Try SQLite format: "YYYY-MM-DD HH:MM:SS"
    if let Ok(naive_dt) = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S") {
        return Ok(DateTime::from_naive_utc_and_offset(naive_dt, Utc));
    }
    
    // Try with fractional seconds: "YYYY-MM-DD HH:MM:SS.sss"
    if let Ok(naive_dt) = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S%.f") {
        return Ok(DateTime::from_naive_utc_and_offset(naive_dt, Utc));
    }
    
    // If all fail, return an error compatible with rusqlite::Error
    Err(rusqlite::Error::InvalidColumnType(0, "datetime".to_string(), rusqlite::types::Type::Text))
}

pub struct DatabaseManager {
    connection: Arc<Mutex<Connection>>,
    db_path: String,
}

#[derive(Debug, serde::Serialize)]
pub struct LibraryStats {
    pub total_books: i32,
    pub total_students: i32,
    pub total_borrowings: i32,
    pub overdue_books: i32,
    pub available_books: i32,
    pub categories_count: i32,
}

impl DatabaseManager {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Set aggressive timeout to prevent database lock issues
        conn.busy_timeout(std::time::Duration::from_secs(30))?;
        
        // Apply optimized SQLite configuration for both Windows and Unix
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = memory;
            PRAGMA mmap_size = 268435456;
            PRAGMA busy_timeout = 30000;
            PRAGMA wal_autocheckpoint = 1000;
            PRAGMA journal_size_limit = 67108864;
            PRAGMA optimize;
        ")?;
        
        // Apply Windows-specific optimizations if needed
        if windows_fixes::is_windows() {
            windows_fixes::configure_windows_sqlite(&conn)?;
        }
        
        // Run the schema creation
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;
        
        // Run migrations to ensure all tables have sync columns
        Self::run_sync_column_migrations(&conn)?;
        
        // Run supplier column migrations
        Self::run_supplier_column_migrations(&conn)?;
        
        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
            db_path: db_path.to_string(),
        })
    }

    pub fn get_db_path(&self) -> &str {
        &self.db_path
    }

    /// Ensure all tables have the necessary sync columns
    fn run_sync_column_migrations(conn: &Connection) -> Result<()> {
        info!("🔄 Running sync column migrations...");
        
        // List of tables that should have sync columns
        let tables_with_sync = vec![
            "categories", "books", "book_copies", "classes", "students", 
            "staff", "borrowings", "group_borrowings", "fines", "theft_reports"
        ];
        
        for table_name in tables_with_sync {
            // Check if table exists
            let table_exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
                [table_name],
                |row| row.get(0)
            )?;
            
            if table_exists == 0 {
                continue; // Skip if table doesn't exist
            }
            
            // Check and add synced column
            let synced_exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = 'synced'",
                [table_name],
                |row| row.get(0)
            )?;
            
            if synced_exists == 0 {
                let add_synced_sql = format!("ALTER TABLE {} ADD COLUMN synced INTEGER DEFAULT 0", table_name);
                conn.execute(&add_synced_sql, [])?;
                info!("✅ Added 'synced' column to {}", table_name);
            }
            
            // Check and add sync_version column
            let sync_version_exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = 'sync_version'",
                [table_name],
                |row| row.get(0)
            )?;
            
            if sync_version_exists == 0 {
                let add_sync_version_sql = format!("ALTER TABLE {} ADD COLUMN sync_version INTEGER DEFAULT 1", table_name);
                conn.execute(&add_sync_version_sql, [])?;
                info!("✅ Added 'sync_version' column to {}", table_name);
            }
            
            // Check and add deleted column
            let deleted_exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = 'deleted'",
                [table_name],
                |row| row.get(0)
            )?;
            
            if deleted_exists == 0 {
                let add_deleted_sql = format!("ALTER TABLE {} ADD COLUMN deleted INTEGER DEFAULT 0", table_name);
                conn.execute(&add_deleted_sql, [])?;
                info!("✅ Added 'deleted' column to {}", table_name);
            }
        }
        
        // Create performance indexes for fast queries
        let performance_indexes = vec![
            // Sync indexes
            ("idx_categories_sync", "CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(synced, sync_version)"),
            ("idx_books_sync", "CREATE INDEX IF NOT EXISTS idx_books_sync ON books(synced, sync_version)"),
            ("idx_book_copies_sync", "CREATE INDEX IF NOT EXISTS idx_book_copies_sync ON book_copies(synced, sync_version)"),
            ("idx_classes_sync", "CREATE INDEX IF NOT EXISTS idx_classes_sync ON classes(synced, sync_version)"),
            ("idx_students_sync", "CREATE INDEX IF NOT EXISTS idx_students_sync ON students(synced, sync_version)"),
            ("idx_staff_sync", "CREATE INDEX IF NOT EXISTS idx_staff_sync ON staff(synced, sync_version)"),
            ("idx_borrowings_sync", "CREATE INDEX IF NOT EXISTS idx_borrowings_sync ON borrowings(synced, sync_version)"),
            ("idx_group_borrowings_sync", "CREATE INDEX IF NOT EXISTS idx_group_borrowings_sync ON group_borrowings(synced, sync_version)"),
            ("idx_fines_sync", "CREATE INDEX IF NOT EXISTS idx_fines_sync ON fines(synced, sync_version)"),
            ("idx_theft_reports_sync", "CREATE INDEX IF NOT EXISTS idx_theft_reports_sync ON theft_reports(synced, sync_version)"),
            
            // Performance indexes for borrowings management
            ("idx_borrowings_status_due", "CREATE INDEX IF NOT EXISTS idx_borrowings_status_due ON borrowings(status, due_date, deleted)"),
            ("idx_borrowings_student_status", "CREATE INDEX IF NOT EXISTS idx_borrowings_student_status ON borrowings(student_id, status, deleted)"),
            ("idx_borrowings_book_status", "CREATE INDEX IF NOT EXISTS idx_borrowings_book_status ON borrowings(book_id, status, deleted)"),
            ("idx_borrowings_created_status", "CREATE INDEX IF NOT EXISTS idx_borrowings_created_status ON borrowings(created_at DESC, status, deleted)"),
            ("idx_students_admission", "CREATE INDEX IF NOT EXISTS idx_students_admission ON students(admission_number, deleted)"),
            ("idx_students_name", "CREATE INDEX IF NOT EXISTS idx_students_name ON students(first_name, last_name, deleted)"),
            ("idx_books_title", "CREATE INDEX IF NOT EXISTS idx_books_title ON books(title, deleted)"),
            ("idx_book_copies_identifier", "CREATE INDEX IF NOT EXISTS idx_book_copies_identifier ON book_copies(copy_identifier, deleted)"),
        ];
        
        for (_index_name, create_sql) in performance_indexes {
            conn.execute(create_sql, [])?;
        }
        
        info!("✅ Sync column migrations completed successfully");
        Ok(())
    }

    /// Add supplier columns to books table if they don't exist
    fn run_supplier_column_migrations(conn: &Connection) -> Result<()> {
        info!("🔄 Running supplier column migrations...");
        
        // Check if supplier_type column exists
        let supplier_type_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('books') WHERE name = 'supplier_type'",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        if supplier_type_exists == 0 {
            conn.execute(
                "ALTER TABLE books ADD COLUMN supplier_type TEXT CHECK (supplier_type IN ('government', 'bookshop', 'donors', 'others'))",
                []
            )?;
            info!("✅ Added 'supplier_type' column to books");
        }
        
        // Check if supplier_name column exists
        let supplier_name_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('books') WHERE name = 'supplier_name'",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        if supplier_name_exists == 0 {
            conn.execute(
                "ALTER TABLE books ADD COLUMN supplier_name TEXT",
                []
            )?;
            info!("✅ Added 'supplier_name' column to books");
        }
        
        info!("✅ Supplier column migrations completed successfully");
        Ok(())
    }

    /// Get a reference to the connection for direct database operations
    pub fn get_connection(&self) -> &Arc<Mutex<Connection>> {
        &self.connection
    }

    /// Safely lock the database connection with proper error handling and timeout detection
    fn lock_connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        // Use a simple blocking lock with timeout
        match self.connection.lock() {
            Ok(guard) => Ok(guard),
            Err(e) => {
                eprintln!("❌ Database connection poisoned: {:?}", e);
                Err(rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
                    Some("Database connection is poisoned".to_string())
                ))
            }
        }
    }

    /// Fix ISBN unique constraint by recreating books table without the constraint
    pub async fn fix_isbn_unique_constraint() -> Result<()> {
        use std::path::PathBuf;
        use rusqlite::Connection;
        
        let app_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("library-management-system");
        let db_path = app_dir.join("library.db");
        
        let conn = Connection::open(&db_path)?;
        
        // Start transaction
        conn.execute("BEGIN TRANSACTION", [])?;
        
        // Create new books table without ISBN unique constraint
        conn.execute(r#"
            CREATE TABLE IF NOT EXISTS books_new (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                isbn TEXT,
                genre TEXT,
                publisher TEXT,
                publication_year INTEGER,
                total_copies INTEGER DEFAULT 1 NOT NULL,
                available_copies INTEGER DEFAULT 1 NOT NULL,
                shelf_location TEXT,
                cover_image_url TEXT,
                description TEXT,
                status TEXT DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'damaged', 'lost')),
                category_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'damaged', 'lost', 'stolen')),
                book_code TEXT UNIQUE,
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        "#, [])?;
        
        // Copy data from old table to new table
        conn.execute(r#"
            INSERT INTO books_new 
            SELECT * FROM books
        "#, [])?;
        
        // Drop old table
        conn.execute("DROP TABLE books", [])?;
        
        // Rename new table
        conn.execute("ALTER TABLE books_new RENAME TO books", [])?;
        
        // Recreate indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_books_sync ON books(synced, sync_version)", [])?;
        
        // Recreate trigger
        conn.execute(r#"
            CREATE TRIGGER IF NOT EXISTS update_books_timestamp 
            AFTER UPDATE ON books 
            BEGIN 
                UPDATE books SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        "#, [])?;
        
        // Commit transaction
        conn.execute("COMMIT", [])?;
        
        println!("✅ ISBN unique constraint removed successfully");
        Ok(())
    }

    pub fn get_next_legacy_book_id(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        
        // Get the highest legacy_book_id from both books and book_copies tables
        let books_max: Option<i32> = conn.query_row(
            "SELECT MAX(legacy_book_id) FROM books WHERE legacy_book_id IS NOT NULL",
            [],
            |row| row.get(0)
        ).unwrap_or(None);
        
        let copies_max: Option<i32> = conn.query_row(
            "SELECT MAX(legacy_book_id) FROM book_copies WHERE legacy_book_id IS NOT NULL",
            [],
            |row| row.get(0)
        ).unwrap_or(None);
        
        let max_id = books_max.max(copies_max).unwrap_or(0);
        let next_id = max_id + 1;
        
        println!("📊 Next sequential legacy_book_id: {} (books max: {:?}, copies max: {:?})", next_id, books_max, copies_max);
        
        Ok(next_id)
    }

    pub async fn create_book(&self, book: &Book) -> Result<()> {
        println!("📚 Database: Creating book '{}' with legacy_id: {:?}", book.title, book.legacy_book_id);
        
        let conn = self.lock_connection()?;
        // Use INSERT OR REPLACE to handle duplicates gracefully
        conn.execute(
            "INSERT OR REPLACE INTO books (id, title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, shelf_location, description, book_code, acquisition_year, legacy_book_id, legacy_isbn, supplier_type, supplier_name, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
            rusqlite::params![
                book.id.to_string(),
                &book.title,
                &book.author,
                &book.isbn,
                &book.publisher,
                book.publication_year,
                book.category_id.map(|id| id.to_string()),
                book.total_copies,
                book.available_copies,
                &book.shelf_location,
                &book.description,
                &book.book_code,
                book.acquisition_year,
                book.legacy_book_id,
                &book.legacy_isbn,
                &book.supplier_type,
                &book.supplier_name,
                book.created_at.to_rfc3339(),
                book.updated_at.to_rfc3339(),
            ],
        )?;
        
        println!("✅ Book record saved to database");
        
        // Skip automatic book copy creation - handled by create_book_with_copies function
        println!("✅ Book created successfully (copies will be created separately)");
        
        Ok(())
    }

    pub async fn get_books(&self) -> Result<Vec<Book>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, shelf_location, description, book_code, acquisition_year, legacy_book_id, legacy_isbn, created_at, updated_at 
             FROM books WHERE deleted = 0 ORDER BY title"
        )?;

        let books = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let category_id_str: Option<String> = row.get(6)?;
            let book_code: Option<String> = row.get(11)?;
            let acquisition_year: Option<i32> = row.get(12)?;
            let legacy_book_id: Option<i32> = row.get(13)?;
            let legacy_isbn: Option<String> = row.get(14)?;
            let created_str: String = row.get(15)?;
            let updated_str: String = row.get(16)?;
            
            Ok(Book {
                id: Uuid::parse_str(&id_str).map_err(|e| {
                    eprintln!("Failed to parse book ID '{}': {}", id_str, e);
                    rusqlite::Error::InvalidColumnType(0, "id".to_string(), rusqlite::types::Type::Text)
                })?,
                title: row.get(1)?,
                author: row.get(2)?,
                isbn: row.get(3)?,
                genre: None, // Not in simplified schema
                publisher: row.get(4)?,
                publication_year: row.get(5)?,
                category_id: category_id_str.and_then(|s| Uuid::parse_str(&s).ok()),
                total_copies: row.get(7)?,
                available_copies: row.get(8)?,
                shelf_location: row.get(9)?,
                cover_image_url: None,
                description: row.get(10)?,
                status: BookStatus::Available, // Default
                condition: None,
                book_code,
                acquisition_year,
                legacy_book_id,
                legacy_isbn,
                supplier_type: None, // TODO: Add to query when needed
                supplier_name: None, // TODO: Add to query when needed
                created_at: parse_sqlite_datetime(&created_str)
                    .map_err(|e| {
                        eprintln!("Failed to parse book created_at '{}': {}", created_str, e);
                        rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text)
                    })?,
                updated_at: parse_sqlite_datetime(&updated_str)
                    .map_err(|e| {
                        eprintln!("Failed to parse book updated_at '{}': {}", updated_str, e);
                        rusqlite::Error::InvalidColumnType(0, "updated_at".to_string(), rusqlite::types::Type::Text)
                    })?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(books)
    }

    pub async fn get_book_by_id(&self, book_id: &Uuid) -> Result<Book> {
        let conn = self.lock_connection()?;
        
        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, publisher, publication_year, category_id, 
             total_copies, available_copies, shelf_location, description, book_code, 
             acquisition_year, legacy_book_id, legacy_isbn, created_at, updated_at
             FROM books WHERE id = ?1"
        )?;
        
        let book = stmt.query_row([book_id.to_string()], |row| {
            let id_str: String = row.get(0)?;
            let category_id_str: Option<String> = row.get(6)?;
            let book_code: Option<String> = row.get(11)?;
            let acquisition_year: Option<i32> = row.get(12)?;
            let legacy_book_id: Option<i32> = row.get(13)?;
            let legacy_isbn: Option<String> = row.get(14)?;
            let created_str: String = row.get(15)?;
            let updated_str: String = row.get(16)?;
            
            Ok(Book {
                id: Uuid::parse_str(&id_str).map_err(|e| {
                    eprintln!("Failed to parse book ID '{}': {}", id_str, e);
                    rusqlite::Error::InvalidColumnType(0, "id".to_string(), rusqlite::types::Type::Text)
                })?,
                title: row.get(1)?,
                author: row.get(2)?,
                isbn: row.get(3)?,
                genre: None,
                publisher: row.get(4)?,
                publication_year: row.get(5)?,
                category_id: category_id_str.and_then(|s| Uuid::parse_str(&s).ok()),
                total_copies: row.get(7)?,
                available_copies: row.get(8)?,
                shelf_location: row.get(9)?,
                cover_image_url: None,
                description: row.get(10)?,
                status: BookStatus::Available,
                condition: None,
                book_code,
                acquisition_year,
                legacy_book_id,
                legacy_isbn,
                supplier_type: None, // TODO: Add to query when needed
                supplier_name: None, // TODO: Add to query when needed
                created_at: DateTime::parse_from_rfc3339(&created_str).map_err(|e| {
                    eprintln!("Failed to parse book created_at '{}': {}", created_str, e);
                    rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text)
                })?.with_timezone(&chrono::Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).map_err(|e| {
                    eprintln!("Failed to parse book updated_at '{}': {}", updated_str, e);
                    rusqlite::Error::InvalidColumnType(0, "updated_at".to_string(), rusqlite::types::Type::Text)
                })?.with_timezone(&chrono::Utc),
            })
        })?;

        Ok(book)
    }

    pub async fn get_books_with_details(&self) -> Result<Vec<BookWithDetails>> {
        let books = self.get_books().await?;
        Ok(books.into_iter().map(|book| BookWithDetails {
            book,
            category: None,
            copies: vec![],
            active_borrowings: vec![],
        }).collect())
    }

    pub async fn get_categories(&self) -> Result<Vec<Category>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at 
             FROM categories WHERE deleted = 0 ORDER BY name"
        )?;

        let categories = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let created_str: String = row.get(3)?;
            let updated_str: String = row.get(4)?;
            
            Ok(Category {
                id: Uuid::parse_str(&id_str).map_err(|e| {
                    eprintln!("Failed to parse category ID '{}': {}", id_str, e);
                    rusqlite::Error::InvalidColumnType(0, "id".to_string(), rusqlite::types::Type::Text)
                })?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: parse_sqlite_datetime(&created_str)
                    .map_err(|e| {
                        eprintln!("Failed to parse category created_at '{}': {}", created_str, e);
                        rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text)
                    })?,
                updated_at: parse_sqlite_datetime(&updated_str)
                    .map_err(|e| {
                        eprintln!("Failed to parse category updated_at '{}': {}", updated_str, e);
                        rusqlite::Error::InvalidColumnType(0, "updated_at".to_string(), rusqlite::types::Type::Text)
                    })?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(categories)
    }

    pub async fn create_category(&self, category: &Category) -> Result<()> {
        let conn = self.lock_connection()?;
        // Use INSERT OR REPLACE to handle duplicates gracefully
        conn.execute(
            "INSERT OR REPLACE INTO categories (id, name, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                category.id.to_string(),
                &category.name,
                &category.description,
                category.created_at.to_rfc3339(),
                category.updated_at.to_rfc3339(),
            ),
        )?;
        Ok(())
    }

    pub async fn update_category(&self, category: &Category) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE categories SET name = ?2, description = ?3, updated_at = ?4 WHERE id = ?1",
            (
                category.id.to_string(),
                &category.name,
                &category.description,
                category.updated_at.to_rfc3339(),
            ),
        )?;
        Ok(())
    }

    pub async fn delete_category(&self, category_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE categories SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [category_id],
        )?;
        Ok(())
    }

    pub async fn get_students(&self) -> Result<Vec<Student>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT s.id, s.first_name, s.last_name, s.admission_number, s.class_grade, s.email, s.phone, s.address, s.created_at, s.updated_at, c.class_name, s.status 
             FROM students s LEFT JOIN classes c ON s.class_grade = c.class_name WHERE s.deleted = 0 ORDER BY s.first_name, s.last_name"
        )?;

        let students = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let class_grade_str: String = row.get(4)?;
            let created_str: String = row.get(8)?;
            let updated_str: String = row.get(9)?;
            let class_name: Option<String> = row.get(10)?;
            let status: Option<String> = row.get(11)?;
            
            Ok(Student {
                id: Uuid::parse_str(&id_str).map_err(|e| {
                    eprintln!("Failed to parse student ID '{}': {:?}", id_str, e);
                    rusqlite::Error::InvalidColumnType(0, "id".to_string(), rusqlite::types::Type::Text)
                })?,
                admission_number: row.get(3)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                email: row.get(5)?,
                phone: row.get(6)?,
                class_grade: class_name.unwrap_or_else(|| class_grade_str.clone()),
                address: row.get(7)?,
                date_of_birth: None, // Not in simplified schema
                enrollment_date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), // Default
                status: status.unwrap_or_else(|| "active".to_string()),
                created_at: parse_sqlite_datetime(&created_str)
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: parse_sqlite_datetime(&updated_str)
                    .unwrap_or_else(|_| Utc::now()),
                class_id: None, // Not using class_id anymore, using class_grade directly
                academic_year: "2024".to_string(), // Default
                is_repeating: false, // Default
                legacy_student_id: None,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(students)
    }

    pub async fn create_student(&self, student: &Student) -> Result<()> {
        let conn = self.lock_connection()?;
        // Use INSERT OR REPLACE to handle duplicates gracefully
        conn.execute(
            "INSERT OR REPLACE INTO students (id, first_name, last_name, admission_number, class_grade, email, phone, address, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (
                student.id.to_string(),
                &student.first_name,
                &student.last_name,
                &student.admission_number,
                &student.class_grade,
                &student.email,
                &student.phone,
                &student.address,
                student.created_at.to_rfc3339(),
                student.updated_at.to_rfc3339(),
            ),
        )?;
        Ok(())
    }

    // Update methods
    pub async fn update_book(&self, book: &Book) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE books SET title = ?2, author = ?3, isbn = ?4, publisher = ?5, publication_year = ?6, 
             category_id = ?7, total_copies = ?8, available_copies = ?9, shelf_location = ?10, 
             description = ?11, book_code = ?12, acquisition_year = ?13, updated_at = ?14 WHERE id = ?1",
            rusqlite::params![
                book.id.to_string(),
                &book.title,
                &book.author,
                &book.isbn,
                &book.publisher,
                book.publication_year,
                book.category_id.map(|id| id.to_string()),
                book.total_copies,
                book.available_copies,
                &book.shelf_location,
                &book.description,
                &book.book_code,
                book.acquisition_year,
                book.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub async fn update_student(&self, student: &Student) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE students SET first_name = ?2, last_name = ?3, admission_number = ?4, 
             class_grade = ?5, email = ?6, phone = ?7, address = ?8, updated_at = ?9 WHERE id = ?1",
            (
                student.id.to_string(),
                &student.first_name,
                &student.last_name,
                &student.admission_number,
                &student.class_grade,
                &student.email,
                &student.phone,
                &student.address,
                student.updated_at.to_rfc3339(),
            ),
        )?;
        Ok(())
    }

    // Delete methods (soft delete)
    pub async fn delete_book(&self, book_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE books SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [book_id],
        )?;
        Ok(())
    }

    pub async fn delete_student(&self, student_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE students SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [student_id],
        )?;
        Ok(())
    }

    pub async fn get_library_stats(&self) -> Result<LibraryStats> {
        // Use optimized single query for better performance
        let conn = self.lock_connection()?;
        
        let stats = conn.query_row(
            "SELECT 
                (SELECT COUNT(*) FROM books WHERE deleted = 0) as total_books,
                (SELECT COUNT(*) FROM students WHERE deleted = 0) as total_students,
                (SELECT COUNT(*) FROM borrowings WHERE status = 'active') as active_borrowings,
                (SELECT COUNT(*) FROM borrowings WHERE status = 'active' AND due_date < date('now')) as overdue_books",
            [],
            |row| {
                let total_books: i32 = row.get(0)?;
                let total_students: i32 = row.get(1)?;
                let active_borrowings: i32 = row.get(2)?;
                let overdue_books: i32 = row.get(3)?;
                
                Ok(LibraryStats {
                    total_books,
                    total_students,
                    total_borrowings: active_borrowings,
                    overdue_books,
                    available_books: total_books - active_borrowings,
                    categories_count: 0,
                })
            }
        )?;

        Ok(stats)
    }

    // Session Management for Offline Authentication
    pub async fn save_user_session(&self, session: &UserSession) -> Result<()> {
        let conn = self.lock_connection()?;
        
        // First, invalidate any existing sessions for this user
        conn.execute(
            "UPDATE user_sessions SET session_valid = 0 WHERE user_id = ?1",
            [&session.user_id],
        )?;
        
        // Insert the new session
        conn.execute(
            "INSERT OR REPLACE INTO user_sessions 
             (id, user_id, email, access_token, refresh_token, expires_at, user_metadata, role, 
              created_at, updated_at, last_activity, session_valid, offline_expiry, device_fingerprint)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            (
                session.id.to_string(),
                &session.user_id,
                &session.email,
                &session.access_token,
                &session.refresh_token,
                session.expires_at.to_rfc3339(),
                &session.user_metadata,
                &session.role,
                session.created_at.to_rfc3339(),
                session.updated_at.to_rfc3339(),
                session.last_activity.to_rfc3339(),
                session.session_valid as i32,
                session.offline_expiry.to_rfc3339(),
                &session.device_fingerprint,
            ),
        )?;
        
        Ok(())
    }

    pub async fn get_valid_user_session(&self, user_id: &str) -> Result<Option<UserSession>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, email, access_token, refresh_token, expires_at, user_metadata, role,
                    created_at, updated_at, last_activity, session_valid, offline_expiry, device_fingerprint
             FROM user_sessions 
             WHERE user_id = ?1 AND session_valid = 1 AND offline_expiry > datetime('now')
             ORDER BY created_at DESC LIMIT 1"
        )?;

        let session_result = stmt.query_row([user_id], |row| {
            let id_str: String = row.get(0)?;
            let expires_str: String = row.get(5)?;
            let created_str: String = row.get(8)?;
            let updated_str: String = row.get(9)?;
            let activity_str: String = row.get(10)?;
            let offline_expiry_str: String = row.get(12)?;
            
            Ok(UserSession {
                id: Uuid::parse_str(&id_str).unwrap(),
                user_id: row.get(1)?,
                email: row.get(2)?,
                access_token: row.get(3)?,
                refresh_token: row.get(4)?,
                expires_at: parse_sqlite_datetime(&expires_str)?,
                user_metadata: row.get(6)?,
                role: row.get(7)?,
                created_at: parse_sqlite_datetime(&created_str)?,
                updated_at: parse_sqlite_datetime(&updated_str)?,
                last_activity: parse_sqlite_datetime(&activity_str)?,
                session_valid: row.get::<_, i32>(11)? == 1,
                offline_expiry: parse_sqlite_datetime(&offline_expiry_str)?,
                device_fingerprint: row.get(13)?,
            })
        });

        match session_result {
            Ok(session) => Ok(Some(session)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub async fn get_any_valid_session(&self) -> Result<Option<UserSession>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, email, access_token, refresh_token, expires_at, user_metadata, role,
                    created_at, updated_at, last_activity, session_valid, offline_expiry, device_fingerprint
             FROM user_sessions 
             WHERE session_valid = 1 AND offline_expiry > datetime('now')
             ORDER BY last_activity DESC LIMIT 1"
        )?;

        let session_result = stmt.query_row([], |row| {
            let id_str: String = row.get(0)?;
            let expires_str: String = row.get(5)?;
            let created_str: String = row.get(8)?;
            let updated_str: String = row.get(9)?;
            let activity_str: String = row.get(10)?;
            let offline_expiry_str: String = row.get(12)?;
            
            Ok(UserSession {
                id: Uuid::parse_str(&id_str).unwrap(),
                user_id: row.get(1)?,
                email: row.get(2)?,
                access_token: row.get(3)?,
                refresh_token: row.get(4)?,
                expires_at: parse_sqlite_datetime(&expires_str)?,
                user_metadata: row.get(6)?,
                role: row.get(7)?,
                created_at: parse_sqlite_datetime(&created_str)?,
                updated_at: parse_sqlite_datetime(&updated_str)?,
                last_activity: parse_sqlite_datetime(&activity_str)?,
                session_valid: row.get::<_, i32>(11)? == 1,
                offline_expiry: parse_sqlite_datetime(&offline_expiry_str)?,
                device_fingerprint: row.get(13)?,
            })
        });

        match session_result {
            Ok(session) => Ok(Some(session)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub async fn update_session_activity(&self, user_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE user_sessions SET last_activity = datetime('now'), updated_at = datetime('now') 
             WHERE user_id = ?1 AND session_valid = 1",
            [user_id],
        )?;
        Ok(())
    }

    pub async fn invalidate_user_session(&self, user_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE user_sessions SET session_valid = 0, updated_at = datetime('now') WHERE user_id = ?1",
            [user_id],
        )?;
        Ok(())
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "DELETE FROM user_sessions WHERE offline_expiry < datetime('now', '-7 days')",
            [],
        )?;
        Ok(())
    }

    // Staff management methods
    #[allow(dead_code)]
    pub async fn get_staff(&self) -> Result<Vec<Staff>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, staff_id, first_name, last_name, email, phone, department, position, status, created_at, updated_at, legacy_staff_id 
             FROM staff WHERE deleted = 0 ORDER BY first_name, last_name"
        )?;

        let staff = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let created_str: String = row.get(9)?;
            let updated_str: String = row.get(10)?;
            
            Ok(Staff {
                id: Uuid::parse_str(&id_str).map_err(|e| {
                    eprintln!("Failed to parse staff ID '{}': {:?}", id_str, e);
                    rusqlite::Error::InvalidColumnType(0, "id".to_string(), rusqlite::types::Type::Text)
                })?,
                staff_id: row.get(1)?,
                first_name: row.get(2)?,
                last_name: row.get(3)?,
                email: row.get(4)?,
                phone: row.get(5)?,
                department: row.get(6)?,
                position: row.get(7)?,
                status: row.get(8)?,
                created_at: DateTime::parse_from_rfc3339(&created_str)
                    .unwrap_or_else(|_| Utc::now().into())
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str)
                    .unwrap_or_else(|_| Utc::now().into())
                    .with_timezone(&Utc),
                legacy_staff_id: row.get(11)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(staff)
    }

    #[allow(dead_code)]
    pub async fn create_staff(&self, staff: &Staff) -> Result<()> {
        let conn = self.lock_connection()?;
        // Use INSERT OR REPLACE to handle duplicates gracefully
        conn.execute(
            "INSERT OR REPLACE INTO staff (id, staff_id, first_name, last_name, email, phone, department, position, status, created_at, updated_at, legacy_staff_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            (
                staff.id.to_string(),
                &staff.staff_id,
                &staff.first_name,
                &staff.last_name,
                &staff.email,
                &staff.phone,
                &staff.department,
                &staff.position,
                &staff.status,
                staff.created_at.to_rfc3339(),
                staff.updated_at.to_rfc3339(),
                &staff.legacy_staff_id,
            ),
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn update_staff(&self, staff: &Staff) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE staff SET staff_id = ?2, first_name = ?3, last_name = ?4, email = ?5, phone = ?6, 
             department = ?7, position = ?8, status = ?9, updated_at = ?10, legacy_staff_id = ?11 WHERE id = ?1",
            (
                staff.id.to_string(),
                &staff.staff_id,
                &staff.first_name,
                &staff.last_name,
                &staff.email,
                &staff.phone,
                &staff.department,
                &staff.position,
                &staff.status,
                staff.updated_at.to_rfc3339(),
                &staff.legacy_staff_id,
            ),
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn delete_staff(&self, staff_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE staff SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [staff_id],
        )?;
        Ok(())
    }

    // Class management methods
    pub async fn get_classes(&self) -> Result<Vec<Class>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, class_name, form_level, class_section, max_books_allowed, is_active, 
             created_at, updated_at, academic_level_type 
             FROM classes WHERE deleted = 0 ORDER BY form_level, class_name"
        )?;

        let classes = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let created_str: String = row.get(6)?;
            let updated_str: String = row.get(7)?;
            let academic_level_str: String = row.get(8)?;
            
            Ok(Class {
                id: Uuid::parse_str(&id_str).map_err(|e| {
                    eprintln!("Failed to parse class ID '{}': {:?}", id_str, e);
                    rusqlite::Error::InvalidColumnType(0, "id".to_string(), rusqlite::types::Type::Text)
                })?,
                class_name: row.get(1)?,
                form_level: row.get(2)?,
                class_section: row.get(3)?,
                max_books_allowed: row.get(4)?,
                is_active: row.get(5)?,
                created_at: DateTime::parse_from_rfc3339(&created_str)
                    .unwrap_or_else(|_| Utc::now().into())
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str)
                    .unwrap_or_else(|_| Utc::now().into())
                    .with_timezone(&Utc),
                academic_level_type: match academic_level_str.as_str() {
                    "grade" => AcademicLevelType::Grade,
                    _ => AcademicLevelType::Form,
                },
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(classes)
    }

    #[allow(dead_code)]
    pub async fn create_class(&self, class: &Class) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "INSERT OR IGNORE INTO classes (id, class_name, form_level, class_section, max_books_allowed, 
             is_active, created_at, updated_at, academic_level_type)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                class.id.to_string(),
                &class.class_name,
                class.form_level,
                &class.class_section,
                class.max_books_allowed,
                class.is_active,
                class.created_at.to_rfc3339(),
                class.updated_at.to_rfc3339(),
                format!("{:?}", class.academic_level_type).to_lowercase(),
            ),
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn update_class(&self, class: &Class) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE classes SET class_name = ?2, form_level = ?3, class_section = ?4, 
             max_books_allowed = ?5, is_active = ?6, updated_at = ?7, academic_level_type = ?8 WHERE id = ?1",
            (
                class.id.to_string(),
                &class.class_name,
                class.form_level,
                &class.class_section,
                class.max_books_allowed,
                class.is_active,
                class.updated_at.to_rfc3339(),
                format!("{:?}", class.academic_level_type).to_lowercase(),
            ),
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn delete_class(&self, class_id: &str) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "UPDATE classes SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [class_id],
        )?;
        Ok(())
    }

    // Book copy management methods
    #[allow(dead_code)]
    pub async fn create_book_copy(
        &self,
        book_copy: &crate::models::BookCopy,
    ) -> Result<()> {
        let conn = self.lock_connection()?;
        
        // Check if book_copies table has book_id column
        let has_book_id_column: bool = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('book_copies') WHERE name = 'book_id'",
            [],
            |row| row.get::<_, i32>(0).map(|count| count > 0)
        ).unwrap_or(false);
        
        // First, get book details from the books table using the book_id
        let book_id_str = book_copy.book_id.map(|id| id.to_string()).unwrap_or_default();
        let book_details: Option<(String, String, String, Option<String>, Option<i32>)> = conn.query_row(
            "SELECT isbn, title, author, publisher, publication_year FROM books WHERE id = ?",
            [&book_id_str],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            }
        ).ok();
        
        let (isbn, title, author, publisher, publication_year) = book_details.unwrap_or_else(|| {
            (
                "UNKNOWN".to_string(),
                "Unknown Title".to_string(),
                "Unknown Author".to_string(),
                None,
                Some(2024),
            )
        });
        
        if has_book_id_column {
            conn.execute(
                "INSERT OR IGNORE INTO book_copies (
                    id, isbn, title, author, publisher, publication_year,
                    copy_identifier, acquisition_date, condition, status,
                    location, department_id, current_borrower_id, borrowed_at,
                    due_date, legacy_book_id, created_at, updated_at, book_id
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, date('now'), ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
                rusqlite::params![
                    book_copy.id.to_string(),
                    isbn,
                    title,
                    author,
                    publisher,
                    publication_year,
                    book_copy.book_code.clone(),
                    format!("{:?}", book_copy.condition).to_lowercase(),
                    format!("{:?}", book_copy.status).to_lowercase(),
                    "Main Library",
                    1,
                    None::<String>,
                    None::<String>,
                    None::<String>,
                    book_copy.legacy_book_id,
                    book_copy.created_at.to_rfc3339(),
                    book_copy.updated_at.to_rfc3339(),
                    if !book_id_str.is_empty() { Some(book_id_str) } else { None }
                ],
            )?;
        } else {
            conn.execute(
                "INSERT OR IGNORE INTO book_copies (
                    id, isbn, title, author, publisher, publication_year,
                    copy_identifier, acquisition_date, condition, status,
                    location, department_id, current_borrower_id, borrowed_at,
                    due_date, legacy_book_id, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, date('now'), ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                rusqlite::params![
                    book_copy.id.to_string(),
                    isbn,
                    title,
                    author,
                    publisher,
                    publication_year,
                    book_copy.book_code.clone(),
                    format!("{:?}", book_copy.condition).to_lowercase(),
                    format!("{:?}", book_copy.status).to_lowercase(),
                    "Main Library",
                    1,
                    None::<String>,
                    None::<String>,
                    None::<String>,
                    book_copy.legacy_book_id,
                    book_copy.created_at.to_rfc3339(),
                    book_copy.updated_at.to_rfc3339(),
                ],
            )?;
        }
        Ok(())
    }
    
    // Create a single book copy directly without complex logic
    pub async fn create_book_copy_direct(
        &self,
        copy_id: i64,
        book_id: &str,
        book_title: &str,
        book_author: &str,
        copy_identifier: &str,
        condition: &str,
        status: &str,
        legacy_book_id: Option<i32>,
    ) -> Result<()> {
        let conn = self.lock_connection()?;
        
        // Check if book_copies table has book_id column
        let has_book_id_column: bool = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('book_copies') WHERE name = 'book_id'",
            [],
            |row| row.get::<_, i32>(0).map(|count| count > 0)
        ).unwrap_or(false);
        
        let now = chrono::Utc::now().to_rfc3339();
        
        if has_book_id_column {
            conn.execute(
                "INSERT INTO book_copies (
                    id, book_id, isbn, title, author,
                    copy_identifier, condition, status, legacy_book_id,
                    created_at, updated_at, synced, sync_version, deleted
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                rusqlite::params![
                    copy_id,
                    book_id,
                    "UNKNOWN", // isbn
                    book_title,
                    book_author,
                    copy_identifier,
                    condition,
                    status,
                    legacy_book_id,
                    now,
                    now,
                    0, // synced
                    1, // sync_version
                    0, // deleted
                ],
            )?;
        } else {
            conn.execute(
                "INSERT INTO book_copies (
                    id, isbn, title, author,
                    copy_identifier, condition, status, legacy_book_id,
                    created_at, updated_at, synced, sync_version, deleted
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                rusqlite::params![
                    copy_id,
                    "UNKNOWN", // isbn
                    book_title,
                    book_author,
                    copy_identifier,
                    condition,
                    status,
                    legacy_book_id,
                    now,
                    now,
                    0, // synced
                    1, // sync_version
                    0, // deleted
                ],
            )?;
        }
        
        Ok(())
    }

    // Borrowing management methods
    #[allow(dead_code)]
    pub async fn return_book(&self, borrowing_id: &str, return_date: &str, status: &str, fine_amount: Option<f64>, returned_by: Option<&str>, condition_at_return: &str, return_notes: &str, copy_condition: &str, is_lost: bool) -> Result<()> {
        let conn = self.lock_connection()?;
        
        // Start transaction for atomic operations
        let tx = conn.unchecked_transaction()?;
        
        // Ensure status is set to 'returned' if not explicitly provided
        let final_status = if status.is_empty() || status == "active" || status == "borrowed" {
            "returned"
        } else {
            status
        };
        
        // Ensure return_date is set to current date if empty
        let final_return_date = if return_date.is_empty() {
            Utc::now().to_rfc3339()
        } else {
            return_date.to_string()
        };
        
        // Get borrowing details first to update book copy and available count
        let borrowing_info: Option<(Option<String>, Option<String>)> = tx.query_row(
            "SELECT book_id, book_copy_id FROM borrowings WHERE id = ?",
            [borrowing_id],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).ok();
        
        // Update the borrowing record with return information
        let rows_affected = tx.execute(
            "UPDATE borrowings SET 
                returned_date = ?1, 
                status = ?2, 
                fine_amount = ?3, 
                returned_by = ?4, 
                condition_at_return = ?5, 
                return_notes = ?6, 
                copy_condition = ?7, 
                is_lost = ?8, 
                updated_at = ?9
            WHERE id = ?10",
            rusqlite::params![
                final_return_date,
                final_status,
                fine_amount,
                returned_by,
                condition_at_return,
                return_notes,
                copy_condition,
                is_lost.to_string(),
                Utc::now().to_rfc3339(),
                borrowing_id,
            ],
        )?;
        
        if rows_affected == 0 {
            tx.rollback()?;
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        
        // Update book copy status back to available if book_copy_id exists
        if let Some((book_id, book_copy_id)) = borrowing_info {
            if let Some(copy_id) = book_copy_id {
                tx.execute(
                    "UPDATE book_copies SET status = 'available', current_borrower_id = NULL, borrowed_at = NULL, due_date = NULL, updated_at = datetime('now') WHERE id = ?",
                    [copy_id],
                )?;
            }
            
            // Update available copies count
            if let Some(b_id) = book_id {
                tx.execute(
                    "UPDATE books SET available_copies = available_copies + 1, updated_at = datetime('now') WHERE id = ?",
                    [b_id],
                )?;
            }
        }
        
        // Commit transaction
        tx.commit()?;
        
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_borrowings_with_details(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        
        // Optimized query with staff JOIN for complete borrowing details
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.student_id, b.book_id, b.borrowed_date, b.due_date, b.returned_date,
                b.status, b.fine_amount, b.notes, b.tracking_code, b.borrower_type, b.staff_id,
                b.condition_at_return,
                s.first_name as student_first_name, s.last_name as student_last_name, 
                s.admission_number, s.class_grade,
                st.first_name as staff_first_name, st.last_name as staff_last_name,
                st.staff_id as staff_identifier, st.department as staff_department,
                st.position as staff_position, st.email as staff_email,
                COALESCE(bk.title, bc.title, 'Unknown Book') as book_title, 
                COALESCE(bk.author, bc.author, 'Unknown Author') as book_author, 
                COALESCE(bk.isbn, bc.isbn) as book_isbn,
                bc.copy_identifier as copy_number,
                bc.legacy_book_id
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id AND s.deleted = 0
            LEFT JOIN staff st ON b.staff_id = st.id AND st.deleted = 0
            LEFT JOIN books bk ON b.book_id = bk.id AND bk.deleted = 0
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND bc.deleted = 0
            WHERE b.deleted = 0
            ORDER BY 
                CASE WHEN b.status = 'active' THEN 0 ELSE 1 END,
                b.created_at DESC,
                b.borrowed_date DESC
        ")?;

        let borrowing_iter = stmt.query_map([], |row| {
            let borrower_type = row.get::<_, Option<String>>("borrower_type")
                .unwrap_or(Some("student".to_string()))
                .unwrap_or("student".to_string());
            
            // Optimized object building with minimal allocations
            let students = match (
                row.get::<_, Option<String>>("student_first_name"),
                row.get::<_, Option<String>>("student_last_name")
            ) {
                (Ok(Some(first)), Ok(Some(last))) => serde_json::json!({
                    "id": row.get::<_, Option<String>>("student_id")?,
                    "first_name": first,
                    "last_name": last,
                    "admission_number": row.get::<_, Option<String>>("admission_number")?,
                    "class_grade": row.get::<_, Option<String>>("class_grade")?
                }),
                _ => serde_json::Value::Null
            };

            let staff = match (
                row.get::<_, Option<String>>("staff_first_name"),
                row.get::<_, Option<String>>("staff_last_name")
            ) {
                (Ok(Some(first)), Ok(Some(last))) => serde_json::json!({
                    "id": row.get::<_, Option<String>>("staff_id")?,
                    "first_name": first,
                    "last_name": last,
                    "staff_id": row.get::<_, Option<String>>("staff_identifier")?,
                    "department": row.get::<_, Option<String>>("staff_department")?,
                    "position": row.get::<_, Option<String>>("staff_position")?,
                    "email": row.get::<_, Option<String>>("staff_email")?
                }),
                _ => serde_json::Value::Null
            };
            
            let book_title = row.get::<_, String>("book_title")?;
            let book_author = row.get::<_, String>("book_author")?;
            
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "student_id": row.get::<_, Option<String>>("student_id")?,
                "book_id": row.get::<_, Option<String>>("book_id")?,
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "returned_date": row.get::<_, Option<String>>("returned_date")?,
                "status": row.get::<_, String>("status")?,
                "fine_amount": row.get::<_, Option<f64>>("fine_amount").unwrap_or(Some(0.0)),
                "notes": row.get::<_, Option<String>>("notes")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "borrower_type": borrower_type,
                "staff_id": row.get::<_, Option<String>>("staff_id")?,
                "condition_at_return": row.get::<_, Option<String>>("condition_at_return")?,
                "students": students,
                "staff": staff,
                "books": serde_json::json!({
                    "id": row.get::<_, Option<String>>("book_id")?,
                    "title": book_title,
                    "author": book_author,
                    "isbn": row.get::<_, Option<String>>("book_isbn")?
                }),
                "book_copies": match row.get::<_, Option<String>>("copy_number") {
                    Ok(Some(copy)) => serde_json::json!({
                        "copy_identifier": copy,
                        "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?
                    }),
                    _ => match row.get::<_, Option<i64>>("legacy_book_id") {
                        Ok(Some(legacy_id)) => serde_json::json!({
                            "legacy_book_id": legacy_id
                        }),
                        _ => serde_json::Value::Null
                    }
                }
            }))
        })?;

        borrowing_iter.collect::<Result<Vec<_>, _>>()
    }

    // Borrowing management methods
    #[allow(dead_code)]
    pub async fn create_borrowing(&self, borrowing: &crate::models::Borrowing) -> Result<()> {
        println!("🔄 Inserting borrowing into database. ID: {}", borrowing.id);
        println!("📊 Borrowing details: student_id={:?}, book_id={:?}, status={:?}", 
                 borrowing.student_id, borrowing.book_id, borrowing.status);
        
        let conn = self.lock_connection()?;
        
        let result = conn.execute(
            "INSERT OR REPLACE INTO borrowings (
                id, student_id, book_id, borrowed_date, due_date, returned_date, 
                status, fine_amount, notes, issued_by, returned_by, created_at, 
                updated_at, fine_paid, book_copy_id, condition_at_issue, 
                condition_at_return, is_lost, tracking_code, return_notes, 
                copy_condition, group_borrowing_id, borrower_type, staff_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                borrowing.id.to_string(),
                borrowing.student_id.map(|id| id.to_string()),
                borrowing.book_id.map(|id| id.to_string()),
                borrowing.borrowed_date.to_string(),
                borrowing.due_date.to_string(),
                borrowing.returned_date.map(|d| d.to_string()),
                format!("{:?}", borrowing.status).to_lowercase(),
                borrowing.fine_amount,
                borrowing.notes.as_ref(),
                borrowing.issued_by.map(|id| id.to_string()),
                borrowing.returned_by.map(|id| id.to_string()),
                borrowing.created_at.to_rfc3339(),
                borrowing.updated_at.to_rfc3339(),
                if borrowing.fine_paid { 1 } else { 0 },
                borrowing.book_copy_id.map(|id| id.to_string()),
                borrowing.condition_at_issue.clone(),
                borrowing.condition_at_return.as_ref(),
                if borrowing.is_lost { 1 } else { 0 },
                borrowing.tracking_code.as_ref(),
                borrowing.return_notes.as_ref(),
                borrowing.copy_condition.as_ref(),
                borrowing.group_borrowing_id.map(|id| id.to_string()),
                format!("{:?}", borrowing.borrower_type).to_lowercase(),
                borrowing.staff_id.map(|id| id.to_string()),
            ],
        );
        
        match result {
            Ok(rows_affected) => {
                println!("✅ Borrowing inserted successfully. Rows affected: {}", rows_affected);
                Ok(())
            }
            Err(e) => {
                println!("❌ Failed to insert borrowing: {}", e);
                println!("🔍 Error details: {:?}", e);
                Err(e.into())
            }
        }
    }

    // Book availability management methods
    pub async fn update_book_copy_status(&self, book_copy_id: &str, new_status: &str, location: Option<&str>) -> Result<()> {
        println!("🔄 Updating book copy {} status to: {}", book_copy_id, new_status);
        
        let conn = self.lock_connection()?;
        
        let mut query = "UPDATE book_copies SET status = ?, updated_at = datetime('now')".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![
            Box::new(new_status.to_string())
        ];
        
        if let Some(loc) = location {
            query.push_str(", location = ?");
            params.push(Box::new(loc.to_string()));
        }
        
        query.push_str(" WHERE id = ?");
        params.push(Box::new(book_copy_id.to_string()));
        
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        
        match conn.execute(&query, &param_refs[..]) {
            Ok(rows_affected) => {
                println!("✅ Book copy status updated. Rows affected: {}", rows_affected);
                Ok(())
            }
            Err(e) => {
                println!("❌ Failed to update book copy status: {}", e);
                Err(e.into())
            }
        }
    }
    
    pub async fn update_book_available_copies(&self, book_id: &str, change: i32) -> Result<()> {
        println!("🔄 Updating available copies for book {} by: {}", book_id, change);
        
        let conn = self.lock_connection()?;
        
        let result = conn.execute(
            "UPDATE books SET available_copies = available_copies + ?, updated_at = datetime('now') 
             WHERE id = ? AND available_copies + ? >= 0",
            rusqlite::params![change, book_id, change],
        );
        
        match result {
            Ok(rows_affected) => {
                if rows_affected > 0 {
                    println!("✅ Available copies updated. Rows affected: {}", rows_affected);
                    Ok(())
                } else {
                    let error_msg = "Cannot update available copies - would result in negative count or book not found";
                    println!("❌ {}", error_msg);
                    Err(rusqlite::Error::InvalidColumnType(0, "available_copies".to_string(), rusqlite::types::Type::Integer))
                }
            }
            Err(e) => {
                println!("❌ Failed to update available copies: {}", e);
                Err(e)
            }
        }
    }
    
    pub async fn issue_book(&self, borrowing: &crate::models::Borrowing) -> Result<()> {
        println!("📚 Processing book issue for borrowing: {}", borrowing.id);
        
        // Use a single database connection for all operations to avoid lock contention
        let conn = self.lock_connection()?;
        println!("🔒 Database connection acquired successfully");
        
        // Start a transaction for atomic operations
        let tx = match conn.unchecked_transaction() {
            Ok(transaction) => {
                println!("🔄 Transaction started successfully");
                transaction
            }
            Err(e) => {
                println!("❌ Failed to start transaction: {}", e);
                return Err(e.into());
            }
        };
        
        println!("📝 Inserting borrowing record...");
        
        // 1. Insert borrowing record
        let borrowing_result = tx.execute(
            "INSERT OR REPLACE INTO borrowings (
                id, student_id, book_id, borrowed_date, due_date, returned_date, 
                status, fine_amount, notes, issued_by, returned_by, created_at, 
                updated_at, fine_paid, book_copy_id, condition_at_issue, 
                condition_at_return, is_lost, tracking_code, return_notes, 
                copy_condition, group_borrowing_id, borrower_type, staff_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                borrowing.id.to_string(),
                borrowing.student_id.map(|id| id.to_string()),
                borrowing.book_id.map(|id| id.to_string()),
                borrowing.borrowed_date.to_string(),
                borrowing.due_date.to_string(),
                borrowing.returned_date.map(|d| d.to_string()),
                format!("{:?}", borrowing.status).to_lowercase(),
                borrowing.fine_amount,
                borrowing.notes.as_ref(),
                borrowing.issued_by.map(|id| id.to_string()),
                borrowing.returned_by.map(|id| id.to_string()),
                borrowing.created_at.to_rfc3339(),
                borrowing.updated_at.to_rfc3339(),
                if borrowing.fine_paid { 1 } else { 0 },
                borrowing.book_copy_id.map(|id| id.to_string()),
                borrowing.condition_at_issue.clone(),
                borrowing.condition_at_return.as_ref(),
                if borrowing.is_lost { 1 } else { 0 },
                borrowing.tracking_code.as_ref(),
                borrowing.return_notes.as_ref(),
                borrowing.copy_condition.as_ref(),
                borrowing.group_borrowing_id.map(|id| id.to_string()),
                format!("{:?}", borrowing.borrower_type).to_lowercase(),
                borrowing.staff_id.map(|id| id.to_string()),
            ],
        );
        
        match borrowing_result {
            Ok(rows) => println!("✅ Borrowing record inserted successfully. Rows: {}", rows),
            Err(e) => {
                println!("❌ Failed to insert borrowing: {}", e);
                // Try to rollback transaction
                if let Err(rollback_err) = tx.rollback() {
                    println!("❌ Failed to rollback transaction: {}", rollback_err);
                }
                return Err(e.into());
            }
        }
        
        // 2. Update book copy status if book_copy_id is provided
        if let Some(book_copy_id) = &borrowing.book_copy_id {
            println!("📖 Updating book copy status for: {}", book_copy_id);
            
            let copy_result = tx.execute(
                "UPDATE book_copies SET status = ?, location = ?, updated_at = datetime('now') WHERE id = ?",
                rusqlite::params!["checked_out", "issued_to_student", book_copy_id.to_string()],
            );
            
            match copy_result {
                Ok(rows) => {
                    if rows > 0 {
                        println!("✅ Book copy status updated to 'checked_out'. Rows: {}", rows);
                    } else {
                        println!("⚠️ Warning: No book copy found with ID: {}", book_copy_id);
                    }
                }
                Err(e) => {
                    println!("❌ Failed to update book copy status: {}", e);
                    if let Err(rollback_err) = tx.rollback() {
                        println!("❌ Failed to rollback transaction: {}", rollback_err);
                    }
                    return Err(e.into());
                }
            }
        }
        
        // 3. Update available copies count if book_id is provided
        if let Some(book_id) = &borrowing.book_id {
            println!("📊 Updating available copies for book: {}", book_id);
            
            let book_result = tx.execute(
                "UPDATE books SET available_copies = available_copies - 1, updated_at = datetime('now') 
                 WHERE id = ? AND available_copies > 0",
                rusqlite::params![book_id.to_string()],
            );
            
            match book_result {
                Ok(rows_affected) => {
                    if rows_affected == 0 {
                        println!("⚠️ Warning: No available copies to decrease for book {} (or book not found)", book_id);
                        // Don't fail the transaction, just warn
                    } else {
                        println!("✅ Available copies decreased by 1. Rows: {}", rows_affected);
                    }
                }
                Err(e) => {
                    println!("❌ Failed to update available copies: {}", e);
                    if let Err(rollback_err) = tx.rollback() {
                        println!("❌ Failed to rollback transaction: {}", rollback_err);
                    }
                    return Err(e.into());
                }
            }
        }
        
        // Commit the transaction
        println!("💾 Committing transaction...");
        match tx.commit() {
            Ok(_) => {
                println!("✅ Book issued successfully - all updates completed in single transaction");
                Ok(())
            }
            Err(e) => {
                println!("❌ Failed to commit transaction: {}", e);
                Err(e.into())
            }
        }
    }
    
    pub async fn process_book_return(&self, borrowing_id: &str, return_condition: Option<&str>) -> Result<()> {
        println!("📚 Processing book return for borrowing: {}", borrowing_id);
        
        // Use a single database connection for all operations
        let conn = self.lock_connection()?;
        
        // Start a transaction for atomic operations
        let tx = conn.unchecked_transaction()?;
        
        // Get borrowing details first
        let borrowing_info: Option<(Option<String>, Option<String>)> = {
            let mut stmt = tx.prepare(
                "SELECT book_id, book_copy_id FROM borrowings WHERE id = ? AND status = 'active'"
            )?;
            
            use rusqlite::OptionalExtension;
            stmt.query_row(
                rusqlite::params![borrowing_id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<String>>(1)?
                    ))
                }
            ).optional()?
        };
        
        if let Some((book_id, book_copy_id)) = borrowing_info {
            // 1. Update borrowing status
            let borrowing_result = tx.execute(
                "UPDATE borrowings SET status = 'returned', returned_date = datetime('now'), 
                 condition_at_return = ?, updated_at = datetime('now') WHERE id = ?",
                rusqlite::params![return_condition, borrowing_id],
            );
            
            if let Err(e) = borrowing_result {
                println!("❌ Failed to update borrowing status: {}", e);
                return Err(e.into());
            }
            
            // 2. Update book copy status
            if let Some(copy_id) = &book_copy_id {
                let copy_result = tx.execute(
                    "UPDATE book_copies SET status = ?, location = ?, updated_at = datetime('now') WHERE id = ?",
                    rusqlite::params!["available", "library_shelf", copy_id],
                );
                
                if let Err(e) = copy_result {
                    println!("❌ Failed to update book copy status: {}", e);
                    return Err(e.into());
                }
                println!("✅ Book copy status updated to 'available'");
            }
            
            // 3. Update available copies count
            if let Some(b_id) = &book_id {
                let book_result = tx.execute(
                    "UPDATE books SET available_copies = available_copies + 1, updated_at = datetime('now') WHERE id = ?",
                    rusqlite::params![b_id],
                );
                
                if let Err(e) = book_result {
                    println!("❌ Failed to update available copies: {}", e);
                    return Err(e.into());
                }
                println!("✅ Available copies increased by 1");
            }
            
            // Commit the transaction
            match tx.commit() {
                Ok(_) => {
                    println!("✅ Book returned successfully - all updates completed in single transaction");
                    Ok(())
                }
                Err(e) => {
                    println!("❌ Failed to commit return transaction: {}", e);
                    Err(e.into())
                }
            }
        } else {
            println!("❌ Borrowing not found or already returned");
            Err(rusqlite::Error::QueryReturnedNoRows.into())
        }
    }

    // Fine management methods
    #[allow(dead_code)]
    pub async fn create_fine(&self, fine: &crate::models::Fine) -> Result<()> {
        let conn = self.lock_connection()?;
        conn.execute(
            "INSERT INTO fines (id, student_id, borrowing_id, fine_type, amount, description,
             status, created_at, updated_at, created_by, borrower_type, staff_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            (
                fine.id.to_string(),
                fine.student_id.map(|id| id.to_string()),
                fine.borrowing_id.map(|id| id.to_string()),
                format!("{:?}", fine.fine_type).to_lowercase(),
                fine.amount,
                &fine.description,
                format!("{:?}", fine.status).to_lowercase(),
                fine.created_at.to_rfc3339(),
                fine.updated_at.to_rfc3339(),
                fine.created_by.map(|id| id.to_string()),
                format!("{:?}", fine.borrower_type).to_lowercase(),
                fine.staff_id.map(|id| id.to_string()),
            ),
        )?;
        Ok(())
    }

    // Additional methods for professional sync UI
    #[allow(dead_code)]
    pub async fn get_books_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM books")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_students_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM students")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_categories_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM categories")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }



    #[allow(dead_code)]
    pub async fn get_borrowings_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM borrowings")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_book_copies_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM book_copies")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_staff_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM staff")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_classes_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM classes")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_fines_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM fines")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_fine_settings_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM fine_settings")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn get_group_borrowings_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM group_borrowings")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_group_borrowings_with_details(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                gb.id, gb.book_id, gb.book_copy_id, gb.tracking_code, gb.borrowed_date, gb.due_date, 
                gb.returned_date, gb.status, gb.notes, gb.issued_by, gb.returned_by, 
                gb.created_at, gb.updated_at, gb.student_ids, gb.condition_at_issue, 
                gb.condition_at_return, gb.return_notes, gb.fine_amount, gb.fine_paid, 
                gb.student_count,
                bc.title as book_title, bc.author as book_author, bc.isbn as book_isbn,
                bc.copy_identifier as copy_number, bc.condition as copy_condition_status
            FROM group_borrowings gb
            LEFT JOIN book_copies bc ON gb.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
            WHERE (gb.deleted = 0 OR gb.deleted IS NULL)
            ORDER BY gb.created_at DESC
        ")?;
        
        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "book_id": row.get::<_, Option<String>>("book_id")?,
                "book_copy_id": row.get::<_, Option<String>>("book_copy_id")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "borrowed_date": row.get::<_, Option<String>>("borrowed_date")?,
                "due_date": row.get::<_, Option<String>>("due_date")?,
                "returned_date": row.get::<_, Option<String>>("returned_date")?,
                "status": row.get::<_, Option<String>>("status")?.unwrap_or_else(|| "active".to_string()),
                "notes": row.get::<_, Option<String>>("notes")?,
                "issued_by": row.get::<_, Option<String>>("issued_by")?,
                "returned_by": row.get::<_, Option<String>>("returned_by")?,
                "created_at": row.get::<_, Option<String>>("created_at")?,
                "updated_at": row.get::<_, Option<String>>("updated_at")?,
                "student_ids": row.get::<_, Option<String>>("student_ids")?,
                "condition_at_issue": row.get::<_, Option<String>>("condition_at_issue")?,
                "condition_at_return": row.get::<_, Option<String>>("condition_at_return")?,
                "return_notes": row.get::<_, Option<String>>("return_notes")?,
                "fine_amount": row.get::<_, Option<f64>>("fine_amount")?.unwrap_or(0.0),
                "fine_paid": row.get::<_, Option<bool>>("fine_paid")?.unwrap_or(false),
                "student_count": row.get::<_, Option<i32>>("student_count")?.unwrap_or(0),
                "books": serde_json::json!({
                    "title": row.get::<_, Option<String>>("book_title")?,
                    "author": row.get::<_, Option<String>>("book_author")?,
                    "isbn": row.get::<_, Option<String>>("book_isbn")?
                }),
                "book_copies": serde_json::json!({
                    "copy_identifier": row.get::<_, Option<String>>("copy_number")?,
                    "condition": row.get::<_, Option<String>>("copy_condition_status")?
                })
            }))
        })?;
        
        let mut borrowings = Vec::new();
        for row in rows {
            borrowings.push(row?);
        }
        
        Ok(borrowings)
    }

    #[allow(dead_code)]
    pub async fn get_theft_reports_count(&self) -> Result<i32> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM theft_reports")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    #[allow(dead_code)]
    pub async fn clear_all_tables(&self) -> Result<()> {
        let conn = self.lock_connection()?;
        
        // Delete data from all tables in reverse dependency order
        conn.execute("DELETE FROM borrowings", [])?;
        conn.execute("DELETE FROM fines", [])?;
        conn.execute("DELETE FROM book_copies", [])?;
        conn.execute("DELETE FROM books", [])?;
        conn.execute("DELETE FROM students", [])?;
        conn.execute("DELETE FROM staff", [])?;
        conn.execute("DELETE FROM categories", [])?;
        conn.execute("DELETE FROM classes", [])?;
        conn.execute("DELETE FROM borrowing_settings", [])?;
        conn.execute("DELETE FROM user_sessions", [])?;
        
        // Reset auto-increment counters (if using AUTOINCREMENT)
        conn.execute("DELETE FROM sqlite_sequence", [])?;
        
        Ok(())
    }

    // Book copy search methods for group borrowing
    pub async fn get_book_copies_with_details(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                bc.id, bc.isbn, bc.title, bc.author, bc.publisher, bc.publication_year,
                bc.copy_identifier, bc.condition, bc.status, bc.location, bc.legacy_book_id,
                bc.tracking_code, bc.created_at, bc.updated_at,
                b.title as book_title, b.author as book_author, b.isbn as book_isbn
            FROM book_copies bc
            LEFT JOIN books b ON bc.book_id = b.id
            WHERE bc.status = 'available' AND (bc.deleted = 0 OR bc.deleted IS NULL)
              AND bc.id NOT IN (
                SELECT book_copy_id FROM borrowings 
                WHERE status = 'active' AND book_copy_id IS NOT NULL
              )
            ORDER BY bc.title, bc.copy_identifier
        ")?;

        let book_copies = stmt.query_map([], |row| {
            // Use book table info if available, fallback to book_copies table
            let title = row.get::<_, Option<String>>("book_title")
                .unwrap_or_default()
                .or_else(|| row.get::<_, String>("title").ok())
                .unwrap_or_else(|| "Unknown Title".to_string());
                
            let author = row.get::<_, Option<String>>("book_author")
                .unwrap_or_default()
                .or_else(|| row.get::<_, String>("author").ok())
                .unwrap_or_else(|| "Unknown Author".to_string());
                
            let isbn = row.get::<_, Option<String>>("book_isbn")
                .unwrap_or_default()
                .or_else(|| row.get::<_, String>("isbn").ok());

            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "isbn": isbn,
                "title": title,
                "author": author,
                "publisher": row.get::<_, Option<String>>("publisher")?,
                "publication_year": row.get::<_, Option<i32>>("publication_year")?,
                "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                "copy_number": row.get::<_, Option<String>>("copy_identifier")?, // Alias for compatibility
                "condition": row.get::<_, String>("condition")?,
                "status": row.get::<_, String>("status")?,
                "location": row.get::<_, Option<String>>("location")?,
                "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "created_at": row.get::<_, String>("created_at")?,
                "updated_at": row.get::<_, String>("updated_at")?,
                "books": serde_json::json!({
                    "title": title,
                    "author": author,
                    "isbn": isbn
                })
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(book_copies)
    }

    // Search book copies by legacy book ID
    pub async fn search_book_copies_by_legacy_id(&self, legacy_id: &str) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                bc.id, bc.isbn, bc.title, bc.author, bc.publisher, bc.publication_year,
                bc.copy_identifier, bc.condition, bc.status, bc.location, bc.legacy_book_id,
                bc.tracking_code, bc.created_at, bc.updated_at, bc.book_id,
                b.title as book_title, b.author as book_author, b.isbn as book_isbn
            FROM book_copies bc
            LEFT JOIN books b ON bc.book_id = b.id
            WHERE bc.legacy_book_id = ? AND (bc.deleted = 0 OR bc.deleted IS NULL)
            ORDER BY bc.title, bc.copy_identifier
        ")?;

        let legacy_id_num: i64 = legacy_id.parse().map_err(|_| {
            rusqlite::Error::InvalidColumnType(0, "legacy_book_id".to_string(), rusqlite::types::Type::Integer)
        })?;

        let book_copies = stmt.query_map([legacy_id_num], |row| {
            // Use book table info if available, fallback to book_copies table
            let title = row.get::<_, Option<String>>("book_title")
                .unwrap_or_default()
                .or_else(|| row.get::<_, String>("title").ok())
                .unwrap_or_else(|| "Unknown Title".to_string());
                
            let author = row.get::<_, Option<String>>("book_author")
                .unwrap_or_default()
                .or_else(|| row.get::<_, String>("author").ok())
                .unwrap_or_else(|| "Unknown Author".to_string());
                
            let isbn = row.get::<_, Option<String>>("book_isbn")
                .unwrap_or_default()
                .or_else(|| row.get::<_, String>("isbn").ok());

            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "isbn": isbn,
                "title": title,
                "author": author,
                "publisher": row.get::<_, Option<String>>("publisher")?,
                "publication_year": row.get::<_, Option<i32>>("publication_year")?,
                "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                "copy_number": row.get::<_, Option<String>>("copy_identifier")?, // Alias for compatibility
                "condition": row.get::<_, String>("condition")?,
                "status": row.get::<_, String>("status")?,
                "location": row.get::<_, Option<String>>("location")?,
                "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "created_at": row.get::<_, String>("created_at")?,
                "updated_at": row.get::<_, String>("updated_at")?,
                "book_id": row.get::<_, Option<String>>("book_id")?,
                "books": serde_json::json!({
                    "title": title,
                    "author": author,
                    "isbn": isbn
                })
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(book_copies)
    }

    // Find active borrowing by legacy book ID
    pub async fn find_borrowing_by_legacy_id(&self, legacy_id: &str) -> Result<Option<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.student_id, b.book_id, b.book_copy_id, b.borrowed_date, b.due_date,
                b.status, b.tracking_code, b.notes, b.created_at, b.updated_at,
                s.id as student_id, s.first_name, s.last_name, s.admission_number, s.class_grade,
                bk.id as book_id, bk.title, bk.author, bk.isbn,
                bc.id as copy_id, bc.legacy_book_id, bc.copy_identifier, bc.condition, bc.status as copy_status
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
            LEFT JOIN books bk ON b.book_id = bk.id AND (bk.deleted = 0 OR bk.deleted IS NULL)
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
            WHERE b.status = 'active' 
              AND bc.legacy_book_id = ? 
              AND (b.deleted = 0 OR b.deleted IS NULL)
            ORDER BY b.borrowed_date DESC
            LIMIT 1
        ")?;

        let legacy_id_num: i64 = legacy_id.parse().map_err(|_| {
            rusqlite::Error::InvalidColumnType(0, "legacy_book_id".to_string(), rusqlite::types::Type::Integer)
        })?;

        let result = stmt.query_row([legacy_id_num], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "student_id": row.get::<_, String>("student_id")?,
                "book_id": row.get::<_, String>("book_id")?,
                "book_copy_id": row.get::<_, String>("book_copy_id")?,
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "status": row.get::<_, String>("status")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "notes": row.get::<_, Option<String>>("notes")?,
                "created_at": row.get::<_, String>("created_at")?,
                "updated_at": row.get::<_, String>("updated_at")?,
                "students": serde_json::json!({
                    "id": row.get::<_, String>("student_id")?,
                    "first_name": row.get::<_, Option<String>>("first_name")?,
                    "last_name": row.get::<_, Option<String>>("last_name")?,
                    "admission_number": row.get::<_, Option<String>>("admission_number")?,
                    "class_grade": row.get::<_, Option<String>>("class_grade")?
                }),
                "books": serde_json::json!({
                    "id": row.get::<_, String>("book_id")?,
                    "title": row.get::<_, Option<String>>("title")?,
                    "author": row.get::<_, Option<String>>("author")?,
                    "isbn": row.get::<_, Option<String>>("isbn")?
                }),
                "book_copies": serde_json::json!({
                    "id": row.get::<_, String>("copy_id")?,
                    "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                    "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                    "condition": row.get::<_, Option<String>>("condition")?,
                    "status": row.get::<_, Option<String>>("copy_status")?
                })
            }))
        });

        match result {
            Ok(borrowing) => Ok(Some(borrowing)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // Enhanced global search across all entities
    pub async fn enhanced_global_search(&self, query: &str, limit: usize) -> Result<serde_json::Value> {
        let conn = self.lock_connection()?;
        let query_lower = query.to_lowercase();
        let query_trimmed = query.trim();
        
        // Check if query is numeric (could be legacy book ID or admission number)
        let is_numeric = query_trimmed.parse::<i64>().is_ok();
        
        // Search students
        let mut students = Vec::new();
        let student_query = if is_numeric {
            // For numeric queries, prioritize exact admission number match
            "SELECT id, first_name, last_name, admission_number, class_grade, email, phone, created_at
             FROM students 
             WHERE (deleted = 0 OR deleted IS NULL) 
               AND (admission_number = ? OR admission_number LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
             ORDER BY 
               CASE WHEN admission_number = ? THEN 0 ELSE 1 END,
               first_name, last_name
             LIMIT ?"
        } else {
            // For text queries, search names and admission numbers
            "SELECT id, first_name, last_name, admission_number, class_grade, email, phone, created_at
             FROM students 
             WHERE (deleted = 0 OR deleted IS NULL) 
               AND (first_name LIKE ? OR last_name LIKE ? OR admission_number LIKE ? OR email LIKE ?)
             ORDER BY first_name, last_name
             LIMIT ?"
        };
        
        let mut stmt = conn.prepare(student_query)?;
        let student_params: Vec<String> = if is_numeric {
            vec![query_trimmed.to_string(), format!("%{}%", query_lower), format!("%{}%", query_lower), 
                 format!("%{}%", query_lower), query_trimmed.to_string(), limit.to_string()]
        } else {
            vec![format!("%{}%", query_lower), format!("%{}%", query_lower), 
                 format!("%{}%", query_lower), format!("%{}%", query_lower), limit.to_string()]
        };
        
        let student_iter = stmt.query_map(rusqlite::params_from_iter(student_params.iter().map(|s| s.as_str())), |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "first_name": row.get::<_, Option<String>>("first_name")?,
                "last_name": row.get::<_, Option<String>>("last_name")?,
                "admission_number": row.get::<_, Option<String>>("admission_number")?,
                "class_grade": row.get::<_, Option<String>>("class_grade")?,
                "email": row.get::<_, Option<String>>("email")?,
                "phone_number": row.get::<_, Option<String>>("phone")?,
                "created_at": row.get::<_, String>("created_at")?,
                "type": "student"
            }))
        })?;
        students.extend(student_iter.collect::<Result<Vec<_>, _>>()?);
        
        // Search books
        let mut books = Vec::new();
        let mut stmt = conn.prepare("
            SELECT id, title, author, isbn, publisher, publication_year, category_id, created_at
            FROM books 
            WHERE (deleted = 0 OR deleted IS NULL) 
              AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR publisher LIKE ?)
            ORDER BY title, author
            LIMIT ?
        ")?;
        
        let book_iter = stmt.query_map([
            format!("%{}%", query_lower), format!("%{}%", query_lower),
            format!("%{}%", query_lower), format!("%{}%", query_lower), limit.to_string()
        ], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "title": row.get::<_, String>("title")?,
                "author": row.get::<_, String>("author")?,
                "isbn": row.get::<_, Option<String>>("isbn")?,
                "publisher": row.get::<_, Option<String>>("publisher")?,
                "publication_year": row.get::<_, Option<i32>>("publication_year")?,
                "category_id": row.get::<_, Option<String>>("category_id")?,
                "created_at": row.get::<_, String>("created_at")?,
                "type": "book"
            }))
        })?;
        books.extend(book_iter.collect::<Result<Vec<_>, _>>()?);
        
        // Search book copies (including legacy book ID)
        let mut book_copies = Vec::new();
        let copy_query = if is_numeric {
            // For numeric queries, prioritize legacy_book_id exact match
            "SELECT CAST(bc.id AS TEXT) as id, bc.legacy_book_id, bc.copy_identifier, bc.condition, bc.status,
                    COALESCE(b.title, bc.title, 'Unknown Title') as title,
                    COALESCE(b.author, bc.author, 'Unknown Author') as author,
                    COALESCE(b.isbn, bc.isbn) as isbn,
                    bc.created_at
             FROM book_copies bc
             LEFT JOIN books b ON bc.isbn = b.isbn AND (b.deleted = 0 OR b.deleted IS NULL)
             WHERE (bc.deleted = 0 OR bc.deleted IS NULL) 
               AND (bc.legacy_book_id = ? OR bc.copy_identifier LIKE ? 
                    OR bc.title LIKE ? OR bc.author LIKE ?)
             ORDER BY 
               CASE WHEN bc.legacy_book_id = ? THEN 0 ELSE 1 END,
               bc.legacy_book_id, bc.copy_identifier
             LIMIT ?"
        } else {
            // For text queries, search titles, authors, and identifiers
            "SELECT CAST(bc.id AS TEXT) as id, bc.legacy_book_id, bc.copy_identifier, bc.condition, bc.status,
                    COALESCE(b.title, bc.title, 'Unknown Title') as title,
                    COALESCE(b.author, bc.author, 'Unknown Author') as author,
                    COALESCE(b.isbn, bc.isbn) as isbn,
                    bc.created_at
             FROM book_copies bc
             LEFT JOIN books b ON bc.isbn = b.isbn AND (b.deleted = 0 OR b.deleted IS NULL)
             WHERE (bc.deleted = 0 OR bc.deleted IS NULL) 
               AND (bc.title LIKE ? OR bc.author LIKE ? OR bc.copy_identifier LIKE ? 
                    OR bc.isbn LIKE ?)
             ORDER BY bc.title, bc.copy_identifier
             LIMIT ?"
        };
        
        let mut stmt = conn.prepare(copy_query)?;
        let copy_params: Vec<String> = if is_numeric {
            let legacy_id: i64 = query_trimmed.parse().unwrap_or(0);
            vec![legacy_id.to_string(), format!("%{}%", query_lower),
                 format!("%{}%", query_lower), format!("%{}%", query_lower), legacy_id.to_string(), limit.to_string()]
        } else {
            vec![format!("%{}%", query_lower), format!("%{}%", query_lower), format!("%{}%", query_lower),
                 format!("%{}%", query_lower), limit.to_string()]
        };
        
        let copy_iter = stmt.query_map(rusqlite::params_from_iter(copy_params.iter().map(|s| s.as_str())), |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                "condition": row.get::<_, Option<String>>("condition")?,
                "status": row.get::<_, Option<String>>("status")?,
                "title": row.get::<_, String>("title")?,
                "author": row.get::<_, String>("author")?,
                "isbn": row.get::<_, Option<String>>("isbn")?,
                "created_at": row.get::<_, String>("created_at")?,
                "type": "book_copy"
            }))
        })?;
        book_copies.extend(copy_iter.collect::<Result<Vec<_>, _>>()?);
        
        // Search active borrowings
        let mut borrowings = Vec::new();
        let borrowing_query = if is_numeric {
            // For numeric queries, search by legacy_book_id and admission_number
            "SELECT b.id, b.borrowed_date, b.due_date, b.status,
                    s.first_name, s.last_name, s.admission_number,
                    COALESCE(bk.title, bc.title, 'Unknown Title') as book_title,
                    COALESCE(bk.author, bc.author, 'Unknown Author') as book_author,
                    bc.legacy_book_id, bc.copy_identifier,
                    b.created_at
             FROM borrowings b
             LEFT JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
             LEFT JOIN books bk ON b.book_id = bk.id AND (bk.deleted = 0 OR bk.deleted IS NULL)
             LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
             WHERE (b.deleted = 0 OR b.deleted IS NULL) 
               AND b.status = 'active'
               AND (bc.legacy_book_id = ? OR s.admission_number = ?)
             ORDER BY 
               CASE WHEN bc.legacy_book_id = ? THEN 0 
                    WHEN s.admission_number = ? THEN 1 
                    ELSE 2 END,
               b.borrowed_date DESC
             LIMIT ?"
        } else {
            // For text queries, search by names and book titles
            "SELECT b.id, b.borrowed_date, b.due_date, b.status,
                    s.first_name, s.last_name, s.admission_number,
                    COALESCE(bk.title, bc.title, 'Unknown Title') as book_title,
                    COALESCE(bk.author, bc.author, 'Unknown Author') as book_author,
                    bc.legacy_book_id, bc.copy_identifier,
                    b.created_at
             FROM borrowings b
             LEFT JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
             LEFT JOIN books bk ON b.book_id = bk.id AND (bk.deleted = 0 OR bk.deleted IS NULL)
             LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
             WHERE (b.deleted = 0 OR b.deleted IS NULL) 
               AND b.status = 'active'
               AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ? 
                    OR bk.title LIKE ? OR bk.author LIKE ?)
             ORDER BY b.borrowed_date DESC
             LIMIT ?"
        };
        
        let mut stmt = conn.prepare(borrowing_query)?;
        let borrowing_params: Vec<String> = if is_numeric {
            let legacy_id: i64 = query_trimmed.parse().unwrap_or(0);
            vec![legacy_id.to_string(), query_trimmed.to_string(),
                 legacy_id.to_string(), query_trimmed.to_string(), limit.to_string()]
        } else {
            vec![format!("%{}%", query_lower), format!("%{}%", query_lower), format!("%{}%", query_lower),
                 format!("%{}%", query_lower), format!("%{}%", query_lower), 
                 limit.to_string()]
        };
        
        let borrowing_iter = stmt.query_map(rusqlite::params_from_iter(borrowing_params.iter().map(|s| s.as_str())), |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "status": row.get::<_, String>("status")?,
                "student_name": format!("{} {}", 
                    row.get::<_, Option<String>>("first_name")?.unwrap_or_default(),
                    row.get::<_, Option<String>>("last_name")?.unwrap_or_default()).trim().to_string(),
                "admission_number": row.get::<_, Option<String>>("admission_number")?,
                "book_title": row.get::<_, String>("book_title")?,
                "book_author": row.get::<_, String>("book_author")?,
                "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                "created_at": row.get::<_, String>("created_at")?,
                "type": "borrowing"
            }))
        })?;
        borrowings.extend(borrowing_iter.collect::<Result<Vec<_>, _>>()?);
        
        Ok(serde_json::json!({
            "students": students,
            "books": books,
            "book_copies": book_copies,
            "borrowings": borrowings,
            "total_students": students.len(),
            "total_books": books.len(),
            "total_book_copies": book_copies.len(),
            "total_borrowings": borrowings.len(),
            "query": query,
            "limit": limit,
            "is_numeric": is_numeric
        }))
    }

    // Search for a single book copy by legacy_book_id for borrowing validation
    pub async fn search_book_copy_by_legacy_id(&self, legacy_book_id: i32) -> Result<Option<serde_json::Value>> {
        let conn = self.lock_connection()?;
        
        let query = "
            SELECT 
                CAST(bc.id AS TEXT) as id, bc.isbn, bc.title, bc.author, bc.publisher, bc.publication_year,
                bc.copy_identifier, bc.condition, bc.status, bc.location, bc.legacy_book_id,
                bc.created_at, bc.updated_at
            FROM book_copies bc
            WHERE bc.legacy_book_id = ? 
              AND (bc.deleted = 0 OR bc.deleted IS NULL)
              AND bc.status = 'available'
              AND bc.id NOT IN (
                  SELECT book_copy_id FROM borrowings 
                  WHERE status = 'active' AND book_copy_id IS NOT NULL
              )
            ORDER BY bc.created_at
            LIMIT 1
        ";
        
        println!("🔍 SQL Query: {}", query);
        println!("🔍 Parameter: {}", legacy_book_id);
        
        let mut stmt = conn.prepare(query)?;
        
        let result = stmt.query_row([legacy_book_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "book_id": row.get::<_, String>("id")?, // Use the copy ID as book_id for compatibility
                "isbn": row.get::<_, String>("isbn")?,
                "title": row.get::<_, String>("title")?,
                "author": row.get::<_, String>("author")?,
                "publisher": row.get::<_, Option<String>>("publisher")?,
                "publication_year": row.get::<_, Option<i32>>("publication_year")?,
                "copy_identifier": row.get::<_, String>("copy_identifier")?,
                "condition": row.get::<_, String>("condition")?,
                "status": row.get::<_, String>("status")?,
                "location": row.get::<_, Option<String>>("location")?,
                "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                "created_at": row.get::<_, String>("created_at")?,
                "updated_at": row.get::<_, String>("updated_at")?,
                "books": serde_json::json!({
                    "id": row.get::<_, String>("id")?,
                    "title": row.get::<_, String>("title")?,
                    "author": row.get::<_, String>("author")?,
                    "isbn": row.get::<_, String>("isbn")?
                })
            }))
        });
        
        match result {
            Ok(book_copy) => Ok(Some(book_copy)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // Get book copies for a specific book by matching legacy_book_id
    pub async fn get_book_copies_by_book_id(&self, book_id: &str) -> Result<Vec<serde_json::Value>> {
        println!("🔍 Database: Getting book copies for book_id: {}", book_id);
        let conn = self.lock_connection()?;
        
        // First get the legacy_book_id from the books table using the UUID book_id
        let legacy_book_id: Option<i64> = conn.query_row(
            "SELECT legacy_book_id FROM books WHERE id = ?",
            [book_id],
            |row| row.get(0)
        ).ok();
        
        if let Some(legacy_id) = legacy_book_id {
            println!("� Database: Found legacy_book_id {} for book_id {}", legacy_id, book_id);
            
            // Use legacy_book_id to find book copies (same logic as borrowing system)
            let mut stmt = conn.prepare("
                SELECT 
                    CAST(id AS TEXT) as id, isbn, title, author, publisher, publication_year,
                    copy_identifier, condition, status, location, legacy_book_id,
                    created_at, updated_at
                FROM book_copies 
                WHERE legacy_book_id = ?
                  AND (deleted = 0 OR deleted IS NULL)
                ORDER BY copy_identifier
            ")?;
            
            let book_copies = stmt.query_map([legacy_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>("id")?,
                    "isbn": row.get::<_, String>("isbn")?,
                    "title": row.get::<_, String>("title")?,
                    "author": row.get::<_, String>("author")?,
                    "publisher": row.get::<_, Option<String>>("publisher")?,
                    "publication_year": row.get::<_, Option<i32>>("publication_year")?,
                    "copy_identifier": row.get::<_, String>("copy_identifier")?,
                    "condition": row.get::<_, String>("condition")?,
                    "status": row.get::<_, String>("status")?,
                    "location": row.get::<_, Option<String>>("location")?,
                    "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                    "created_at": row.get::<_, String>("created_at")?,
                    "updated_at": row.get::<_, String>("updated_at")?
                }))
            })?.collect::<Result<Vec<_>, _>>()?;
            
            println!("✅ Database: Found {} book copies using legacy_book_id {}", book_copies.len(), legacy_id);
            Ok(book_copies)
        } else {
            // Fallback to matching by title and author when no legacy_book_id is found
            println!("🔄 Database: No legacy_book_id found, using fallback method - matching by title and author");
            let book_details: Option<(String, String)> = conn.query_row(
                "SELECT title, author FROM books WHERE id = ?",
                [book_id],
                |row| Ok((row.get(0)?, row.get(1)?))
            ).ok();
            
            if let Some((title, author)) = book_details {
                println!("📖 Database: Found book details - title: '{}', author: '{}'", title, author);
                let mut stmt = conn.prepare("
                    SELECT 
                        CAST(id AS TEXT) as id, isbn, title, author, publisher, publication_year,
                        copy_identifier, condition, status, location, legacy_book_id,
                        created_at, updated_at
                    FROM book_copies 
                    WHERE title = ? AND author = ?
                      AND (deleted = 0 OR deleted IS NULL)
                    ORDER BY copy_identifier
                ")?;
                
                let book_copies = stmt.query_map([&title, &author], |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>("id")?,
                        "isbn": row.get::<_, String>("isbn")?,
                        "title": row.get::<_, String>("title")?,
                        "author": row.get::<_, String>("author")?,
                        "publisher": row.get::<_, Option<String>>("publisher")?,
                        "publication_year": row.get::<_, Option<i32>>("publication_year")?,
                        "copy_identifier": row.get::<_, String>("copy_identifier")?,
                        "condition": row.get::<_, String>("condition")?,
                        "status": row.get::<_, String>("status")?,
                        "location": row.get::<_, Option<String>>("location")?,
                        "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?,
                        "created_at": row.get::<_, String>("created_at")?,
                        "updated_at": row.get::<_, String>("updated_at")?
                    }))
                })?.collect::<Result<Vec<_>, _>>()?;
                
                println!("✅ Database: Found {} book copies using title/author matching", book_copies.len());
                Ok(book_copies)
            } else {
                println!("❌ Database: No book found with id: {}", book_id);
                Ok(Vec::new())
            }
        }
    }

    // Optimized bulk count function for better performance
    pub async fn get_all_counts_optimized(&self) -> Result<std::collections::HashMap<String, i32>> {
        let conn = self.lock_connection()?;
        let mut counts = std::collections::HashMap::new();
        
        // Use a single query with UNION ALL for better performance
        let query = "
            SELECT 'books' as table_name, COUNT(*) as count FROM books
            UNION ALL
            SELECT 'students' as table_name, COUNT(*) as count FROM students
            UNION ALL
            SELECT 'categories' as table_name, COUNT(*) as count FROM categories
            UNION ALL
            SELECT 'borrowings' as table_name, COUNT(*) as count FROM borrowings
            UNION ALL
            SELECT 'book_copies' as table_name, COUNT(*) as count FROM book_copies
            UNION ALL
            SELECT 'staff' as table_name, COUNT(*) as count FROM staff
            UNION ALL
            SELECT 'classes' as table_name, COUNT(*) as count FROM classes
            UNION ALL
            SELECT 'fines' as table_name, COUNT(*) as count FROM fines
            UNION ALL
            SELECT 'fine_settings' as table_name, COUNT(*) as count FROM fine_settings
            UNION ALL
            SELECT 'group_borrowings' as table_name, COUNT(*) as count FROM group_borrowings
            UNION ALL
            SELECT 'theft_reports' as table_name, COUNT(*) as count FROM theft_reports
        ";
        
        let mut stmt = conn.prepare(query)?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        })?;
        
        for row in rows {
            let (table_name, count) = row?;
            counts.insert(table_name, count);
        }
        
        Ok(counts)
    }

    // Simplified book copy creation that matches the actual database schema
    pub async fn create_simple_book_copy(
        &self,
        book_title: &str,
        book_author: &str,
        book_isbn: &str,
        publisher: Option<&str>,
        publication_year: Option<i32>,
        copy_identifier: &str,
        condition: &str,
        status: &str,
        legacy_book_id: Option<i32>,
    ) -> Result<i64> {
        let conn = self.lock_connection()?;
        
        // Generate a timestamp-based ID (similar to existing entries)
        let copy_id = chrono::Utc::now().timestamp_millis();
        
        conn.execute(
            "INSERT INTO book_copies (
                id, isbn, title, author, publisher, publication_year,
                copy_identifier, condition, status, legacy_book_id,
                created_at, updated_at, synced, sync_version, deleted
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            rusqlite::params![
                copy_id,
                book_isbn,
                book_title,
                book_author,
                publisher,
                publication_year,
                copy_identifier,
                condition,
                status,
                legacy_book_id,
                chrono::Utc::now().to_rfc3339(),
                chrono::Utc::now().to_rfc3339(),
                0, // synced
                1, // sync_version
                0, // deleted
            ],
        )?;
        
        println!("✅ Created book copy with ID: {} and legacy_book_id: {:?}", copy_id, legacy_book_id);
        Ok(copy_id)
    }

    // Report query methods for the reports module
    pub fn get_table_count(&self, table_name: &str) -> Result<i64> {
        let conn = self.lock_connection()?;
        let query = format!("SELECT COUNT(*) FROM {}", table_name);
        let mut stmt = conn.prepare(&query)?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub fn get_unsynced_count(&self, table_name: &str) -> Result<i64> {
        let conn = self.lock_connection()?;
        let check_column_query = format!(
            "SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = 'synced'", 
            table_name
        );
        let mut stmt = conn.prepare(&check_column_query)?;
        let has_synced_column: i64 = stmt.query_row([], |row| row.get(0))?;
        
        if has_synced_column > 0 {
            let query = format!("SELECT COUNT(*) FROM {} WHERE synced = 0 OR synced IS NULL", table_name);
            let mut stmt = conn.prepare(&query)?;
            let count: i64 = stmt.query_row([], |row| row.get(0))?;
            Ok(count)
        } else {
            Ok(0)
        }
    }

    // Batch create multiple book copies efficiently
    pub async fn batch_create_book_copies(
        &self,
        book_id: &str,
        book_title: &str,
        book_author: &str,
        book_isbn: &str,
        publisher: Option<&str>,
        publication_year: Option<i32>,
        copy_data: Vec<(String, i32)>, // (copy_identifier, legacy_book_id) pairs
        condition: &str,
        status: &str,
    ) -> Result<Vec<i64>> {
        println!("🔍 DEBUG: batch_create_book_copies called");
        println!("  - book_id: {}", book_id);
        println!("  - book_title: {}", book_title);
        println!("  - copy_data len: {}", copy_data.len());
        println!("  - copy_data: {:?}", copy_data);
        
        // If no copies to create, return early
        if copy_data.is_empty() {
            println!("⚠️ No copy data provided, returning empty");
            return Ok(Vec::new());
        }
        
        let conn = self.lock_connection()?;
        println!("✅ DEBUG: Got database connection");
        let mut created_ids = Vec::new();
        
        // Check if book_copies table has book_id column
        let has_book_id_column: bool = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('book_copies') WHERE name = 'book_id'",
            [],
            |row| row.get::<_, i32>(0).map(|count| count > 0)
        ).unwrap_or(false);
        
        println!("DEBUG: has_book_id_column: {}", has_book_id_column);
        
        // Use a transaction for batch insert - much faster
        let tx = conn.unchecked_transaction()?;
        println!("🔄 DEBUG: Transaction created successfully");
        
        {
            let mut stmt = if has_book_id_column {
                tx.prepare(
                    "INSERT INTO book_copies (
                        id, book_id, isbn, title, author, publisher, publication_year,
                        copy_identifier, condition, status, legacy_book_id,
                        created_at, updated_at, synced, sync_version, deleted
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"
                )?
            } else {
                tx.prepare(
                    "INSERT INTO book_copies (
                        id, isbn, title, author, publisher, publication_year,
                        copy_identifier, condition, status, legacy_book_id,
                        created_at, updated_at, synced, sync_version, deleted
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"
                )?
            };
            
            let now = chrono::Utc::now().to_rfc3339();
            
            for (copy_identifier, legacy_book_id) in copy_data {
                let copy_id = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0) / 1000; // Use nanoseconds for uniqueness
                
                if has_book_id_column {
                    match stmt.execute(rusqlite::params![
                        copy_id,
                        book_id,
                        book_isbn,
                        book_title,
                        book_author,
                        publisher,
                        publication_year,
                        copy_identifier,
                        condition,
                        status,
                        legacy_book_id,
                        now,
                        now,
                        0, // synced
                        1, // sync_version
                        0, // deleted
                    ]) {
                        Ok(_) => {
                            created_ids.push(copy_id);
                            println!("✅ Batch created copy: {} with ID: {} and book_id: {}", copy_identifier, copy_id, book_id);
                        }
                        Err(e) => {
                            println!("❌ Failed to insert copy {}: {}", copy_identifier, e);
                            return Err(e.into());
                        }
                    }
                } else {
                    match stmt.execute(rusqlite::params![
                        copy_id,
                        book_isbn,
                        book_title,
                        book_author,
                        publisher,
                        publication_year,
                        copy_identifier,
                        condition,
                        status,
                        legacy_book_id,
                        now,
                        now,
                        0, // synced
                        1, // sync_version
                        0, // deleted
                    ]) {
                        Ok(_) => {
                            created_ids.push(copy_id);
                            println!("✅ Batch created copy: {} with ID: {} (no book_id column)", copy_identifier, copy_id);
                        }
                        Err(e) => {
                            println!("❌ Failed to insert copy {}: {}", copy_identifier, e);
                            return Err(e.into());
                        }
                    }
                }
            }
        }
        
        println!("💾 About to commit transaction with {} copies", created_ids.len());
        tx.commit()?;
        println!("✅ Transaction committed successfully!");
        println!("🚀 Batch created {} book copies successfully", created_ids.len());
        Ok(created_ids)
    }

    // Report query methods for the reports module
    pub async fn get_student_overdue_books(&self) -> Result<serde_json::Value> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.student_id, b.book_id, b.borrowed_date, b.due_date, b.status,
                s.first_name, s.last_name, s.admission_number, s.class_grade,
                bk.title, bk.author, bk.isbn,
                bc.legacy_book_id,
                CAST((julianday('now') - julianday(b.due_date)) AS INTEGER) as days_overdue
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id
            LEFT JOIN books bk ON b.book_id = bk.id
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE b.status = 'active' AND date(b.due_date) < date('now')
            ORDER BY b.due_date ASC
        ")?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "student": {
                    "id": row.get::<_, Option<String>>("student_id")?,
                    "first_name": row.get::<_, Option<String>>("first_name")?,
                    "last_name": row.get::<_, Option<String>>("last_name")?,
                    "admission_number": row.get::<_, Option<String>>("admission_number")?,
                    "class_grade": row.get::<_, Option<String>>("class_grade")?
                },
                "book": {
                    "id": row.get::<_, Option<String>>("book_id")?,
                    "title": row.get::<_, Option<String>>("title")?,
                    "author": row.get::<_, Option<String>>("author")?,
                    "isbn": row.get::<_, Option<String>>("isbn")?,
                    "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?
                },
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "days_overdue": row.get::<_, i64>("days_overdue")?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(serde_json::json!({ "data": rows }))
    }

    pub async fn get_staff_overdue_books(&self) -> Result<serde_json::Value> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.staff_id, b.book_id, b.borrowed_date, b.due_date, b.status,
                st.first_name, st.last_name, st.staff_id as staff_identifier, st.department,
                bk.title, bk.author, bk.isbn,
                bc.legacy_book_id,
                CAST((julianday('now') - julianday(b.due_date)) AS INTEGER) as days_overdue
            FROM borrowings b
            LEFT JOIN staff st ON b.staff_id = st.id
            LEFT JOIN books bk ON b.book_id = bk.id
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE b.status = 'active' AND date(b.due_date) < date('now') AND b.staff_id IS NOT NULL
            ORDER BY b.due_date ASC
        ")?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "staff": {
                    "id": row.get::<_, Option<String>>("staff_id")?,
                    "first_name": row.get::<_, Option<String>>("first_name")?,
                    "last_name": row.get::<_, Option<String>>("last_name")?,
                    "staff_id": row.get::<_, Option<String>>("staff_identifier")?,
                    "department": row.get::<_, Option<String>>("department")?
                },
                "book": {
                    "id": row.get::<_, Option<String>>("book_id")?,
                    "title": row.get::<_, Option<String>>("title")?,
                    "author": row.get::<_, Option<String>>("author")?,
                    "isbn": row.get::<_, Option<String>>("isbn")?,
                    "legacy_book_id": row.get::<_, Option<i64>>("legacy_book_id")?
                },
                "borrowed_date": row.get::<_, String>("borrowed_date")?,
                "due_date": row.get::<_, String>("due_date")?,
                "days_overdue": row.get::<_, i64>("days_overdue")?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(serde_json::json!({ "data": rows }))
    }

    pub async fn get_borrowing_statistics(&self) -> Result<serde_json::Value> {
        let conn = self.lock_connection()?;
        let stats = conn.query_row(
            "SELECT 
                COUNT(*) as total_borrowings,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_borrowings,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_borrowings,
                COUNT(CASE WHEN status = 'active' AND date(due_date) < date('now') THEN 1 END) as overdue_borrowings
             FROM borrowings",
            [],
            |row| {
                Ok(serde_json::json!({
                    "total_borrowings": row.get::<_, i64>(0)?,
                    "active_borrowings": row.get::<_, i64>(1)?,
                    "returned_borrowings": row.get::<_, i64>(2)?,
                    "overdue_borrowings": row.get::<_, i64>(3)?
                }))
            }
        )?;

        Ok(stats)
    }

    pub async fn get_books_by_category(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                c.name as category_name,
                COUNT(b.id) as book_count
            FROM categories c
            LEFT JOIN books b ON c.id = b.category_id AND b.deleted = 0
            WHERE c.deleted = 0
            GROUP BY c.id, c.name
            ORDER BY book_count DESC
        ")?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "category_name": row.get::<_, String>("category_name")?,
                "book_count": row.get::<_, i64>("book_count")?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(rows)
    }

    pub async fn get_popular_books(&self, limit: i32) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                b.id, b.title, b.author, b.isbn,
                c.name as category_name,
                COUNT(br.id) as borrow_count
            FROM books b
            LEFT JOIN borrowings br ON b.id = br.book_id
            LEFT JOIN categories c ON b.category_id = c.id
            WHERE b.deleted = 0
            GROUP BY b.id, b.title, b.author, b.isbn, c.name
            ORDER BY borrow_count DESC
            LIMIT ?
        ")?;

        let rows = stmt.query_map([limit], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "title": row.get::<_, String>("title")?,
                "author": row.get::<_, String>("author")?,
                "isbn": row.get::<_, Option<String>>("isbn")?,
                "category_name": row.get::<_, Option<String>>("category_name")?,
                "borrow_count": row.get::<_, i64>("borrow_count")?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(rows)
    }

    pub async fn get_class_borrowing_report(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                s.class_grade,
                COUNT(b.id) as total_borrowings,
                COUNT(CASE WHEN b.status = 'active' THEN 1 END) as active_borrowings
            FROM students s
            LEFT JOIN borrowings b ON s.id = b.student_id
            WHERE s.deleted = 0
            GROUP BY s.class_grade
            ORDER BY total_borrowings DESC
        ")?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "class_grade": row.get::<_, Option<String>>("class_grade")?,
                "total_borrowings": row.get::<_, i64>("total_borrowings")?,
                "active_borrowings": row.get::<_, i64>("active_borrowings")?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(rows)
    }

    pub async fn get_fine_reports(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                f.id, f.amount, f.description, f.status, f.created_at,
                s.first_name, s.last_name, s.admission_number, s.class_grade
            FROM fines f
            LEFT JOIN students s ON f.student_id = s.id
            WHERE f.deleted = 0
            ORDER BY f.created_at DESC
        ")?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>("id")?,
                "amount": row.get::<_, f64>("amount")?,
                "description": row.get::<_, String>("description")?,
                "status": row.get::<_, String>("status")?,
                "created_at": row.get::<_, String>("created_at")?,
                "student": {
                    "first_name": row.get::<_, Option<String>>("first_name")?,
                    "last_name": row.get::<_, Option<String>>("last_name")?,
                    "admission_number": row.get::<_, Option<String>>("admission_number")?,
                    "class_grade": row.get::<_, Option<String>>("class_grade")?
                }
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(rows)
    }

    pub async fn get_books_by_supplier(&self) -> Result<Vec<serde_json::Value>> {
        let conn = self.lock_connection()?;
        let mut stmt = conn.prepare("
            SELECT 
                COALESCE(supplier_type, 'unknown') as supplier_type,
                COALESCE(supplier_name, 'Unknown Supplier') as supplier_name,
                COUNT(*) as book_count,
                SUM(total_copies) as total_copies
            FROM books
            WHERE deleted = 0
            GROUP BY supplier_type, supplier_name
            ORDER BY book_count DESC
        ")?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "supplier_type": row.get::<_, String>("supplier_type")?,
                "supplier_name": row.get::<_, String>("supplier_name")?,
                "book_count": row.get::<_, i64>("book_count")?,
                "total_copies": row.get::<_, i64>("total_copies")?
            }))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(rows)
    }
}
