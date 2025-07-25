use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub isbn: Option<String>,
    pub category_id: String,
    pub total_copies: i32,
    pub available_copies: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: String,
    pub name: String,
    pub email: String,
    pub student_id: String,
    pub class_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Borrowing {
    pub id: String,
    pub student_id: String,
    pub book_copy_id: String,
    pub borrowed_at: DateTime<Utc>,
    pub due_date: DateTime<Utc>,
    pub returned_at: Option<DateTime<Utc>>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub shelf_location: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced: bool,
}

pub struct DatabaseManager {
    db_path: PathBuf,
}

unsafe impl Send for DatabaseManager {}
unsafe impl Sync for DatabaseManager {}

impl DatabaseManager {
    pub async fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(&db_path)?;
        
        // Enable WAL mode for better concurrent access
        let _ = conn.execute("PRAGMA journal_mode=WAL", []);
        let _ = conn.execute("PRAGMA synchronous=NORMAL", []);
        let _ = conn.execute("PRAGMA cache_size=10000", []);
        let _ = conn.execute("PRAGMA temp_store=memory", []);
        let _ = conn.execute("PRAGMA mmap_size=268435456", []); // 256MB
        
        let manager = DatabaseManager {
            db_path: db_path.clone(),
        };
        
        manager.initialize_schema_internal().await?;
        Ok(manager)
    }

    pub fn get_connection(&self) -> Result<Connection> {
        let conn = Connection::open(&self.db_path)?;
        let _ = conn.execute("PRAGMA journal_mode=WAL", []);
        let _ = conn.execute("PRAGMA synchronous=NORMAL", []);
        Ok(conn)
    }

    async fn initialize_schema_internal(&self) -> Result<()> {
        let conn = self.get_connection()?;
        
        // Categories table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                shelf_location TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Books table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                isbn TEXT,
                category_id TEXT NOT NULL,
                total_copies INTEGER DEFAULT 0,
                available_copies INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )",
            [],
        )?;

        // Students table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                student_id TEXT UNIQUE NOT NULL,
                class_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Book copies table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS book_copies (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                tracking_code TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'available',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (book_id) REFERENCES books (id)
            )",
            [],
        )?;

        // Borrowings table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS borrowings (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                book_copy_id TEXT NOT NULL,
                borrowed_at TEXT NOT NULL,
                due_date TEXT NOT NULL,
                returned_at TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (student_id) REFERENCES students (id),
                FOREIGN KEY (book_copy_id) REFERENCES book_copies (id)
            )",
            [],
        )?;

        // Sync queue table for offline operations
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                attempts INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Create indexes for better performance
        conn.execute("CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_borrowings_student ON borrowings(student_id)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy ON borrowings(book_copy_id)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_book_copies_tracking ON book_copies(tracking_code)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name)", [])?;

        Ok(())
    }

    pub async fn get_books(&self, limit: Option<i32>, offset: Option<i32>) -> Result<Vec<Book>> {
        let conn = self.get_connection()?;
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);

        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, category_id, total_copies, available_copies, 
             created_at, updated_at, synced FROM books 
             ORDER BY title LIMIT ? OFFSET ?"
        )?;

        let book_iter = stmt.query_map(params![limit, offset], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                isbn: row.get(3)?,
                category_id: row.get(4)?,
                total_copies: row.get(5)?,
                available_copies: row.get(6)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(7))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(8))?
                    .with_timezone(&Utc),
                synced: row.get::<_, i32>(9)? != 0,
            })
        })?;

        let mut books = Vec::new();
        for book in book_iter {
            books.push(book?);
        }

        Ok(books)
    }

    pub async fn search_books(&self, query: &str) -> Result<Vec<Book>> {
        let conn = self.get_connection()?;
        let search_query = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, category_id, total_copies, available_copies, 
             created_at, updated_at, synced FROM books 
             WHERE title LIKE ?1 OR author LIKE ?1 OR isbn LIKE ?1
             ORDER BY title LIMIT 50"
        )?;

        let book_iter = stmt.query_map(params![search_query], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                isbn: row.get(3)?,
                category_id: row.get(4)?,
                total_copies: row.get(5)?,
                available_copies: row.get(6)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(7))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(8))?
                    .with_timezone(&Utc),
                synced: row.get::<_, i32>(9)? != 0,
            })
        })?;

        let mut books = Vec::new();
        for book in book_iter {
            books.push(book?);
        }

        Ok(books)
    }

    pub async fn get_book_by_barcode(&self, barcode: &str) -> Result<Option<Book>> {
        let conn = self.get_connection()?;

        // First try to find by ISBN
        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, category_id, total_copies, available_copies, 
             created_at, updated_at, synced FROM books WHERE isbn = ?"
        )?;

        if let Ok(book) = stmt.query_row(params![barcode], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                isbn: row.get(3)?,
                category_id: row.get(4)?,
                total_copies: row.get(5)?,
                available_copies: row.get(6)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(7))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(8))?
                    .with_timezone(&Utc),
                synced: row.get::<_, i32>(9)? != 0,
            })
        }) {
            return Ok(Some(book));
        }

        // If not found by ISBN, try by tracking code
        let mut stmt = conn.prepare(
            "SELECT b.id, b.title, b.author, b.isbn, b.category_id, b.total_copies, b.available_copies, 
             b.created_at, b.updated_at, b.synced FROM books b
             JOIN book_copies bc ON b.id = bc.book_id 
             WHERE bc.tracking_code = ?"
        )?;

        match stmt.query_row(params![barcode], |row| {
            Ok(Book {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                isbn: row.get(3)?,
                category_id: row.get(4)?,
                total_copies: row.get(5)?,
                available_copies: row.get(6)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(7))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|_| rusqlite::Error::InvalidColumnIndex(8))?
                    .with_timezone(&Utc),
                synced: row.get::<_, i32>(9)? != 0,
            })
        }) {
            Ok(book) => Ok(Some(book)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub async fn add_to_sync_queue(&self, table_name: &str, record_id: &str, operation: &str, data: &str) -> Result<()> {
        let conn = self.get_connection()?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO sync_queue (id, table_name, record_id, operation, data, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, table_name, record_id, operation, data, now],
        )?;

        Ok(())
    }

    pub async fn get_unsynced_records(&self, table_name: &str, limit: i32) -> Result<Vec<(String, String, String, String)>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT id, record_id, operation, data FROM sync_queue 
             WHERE table_name = ? ORDER BY created_at LIMIT ?"
        )?;

        let record_iter = stmt.query_map(params![table_name, limit], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;

        let mut records = Vec::new();
        for record in record_iter {
            records.push(record?);
        }

        Ok(records)
    }

    pub async fn mark_synced(&self, sync_queue_id: &str) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute("DELETE FROM sync_queue WHERE id = ?", params![sync_queue_id])?;
        Ok(())
    }

    pub async fn get_dashboard_stats(&self) -> Result<serde_json::Value> {
        let conn = self.get_connection()?;

        let total_books: i32 = conn.query_row("SELECT COUNT(*) FROM books", [], |row| row.get(0))?;
        let total_students: i32 = conn.query_row("SELECT COUNT(*) FROM students", [], |row| row.get(0))?;
        let active_borrowings: i32 = conn.query_row(
            "SELECT COUNT(*) FROM borrowings WHERE status = 'active'", 
            [], 
            |row| row.get(0)
        )?;
        let overdue_borrowings: i32 = conn.query_row(
            "SELECT COUNT(*) FROM borrowings WHERE status = 'active' AND due_date < datetime('now')", 
            [], 
            |row| row.get(0)
        )?;

        Ok(serde_json::json!({
            "total_books": total_books,
            "total_students": total_students,
            "active_borrowings": active_borrowings,
            "overdue_borrowings": overdue_borrowings
        }))
    }

    pub async fn execute_raw_sql(&self, sql: &str) -> Result<()> {
        let conn = self.get_connection()?;
        conn.execute(sql, [])?;
        Ok(())
    }
}
