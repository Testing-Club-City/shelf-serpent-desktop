use crate::models::*;
use rusqlite::{Connection, Result};
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use std::collections::VecDeque;

/// Multithreaded database manager with connection pooling
pub struct MultithreadedDatabaseManager {
    pool: Arc<RwLock<VecDeque<Connection>>>,
    semaphore: Arc<Semaphore>,
    db_path: String,
    max_connections: usize,
}

impl MultithreadedDatabaseManager {
    pub async fn new(db_path: &str, max_connections: usize) -> Result<Self> {
        let mut pool = VecDeque::new();
        
        // Create initial connections
        for _ in 0..max_connections {
            let conn = Self::create_connection(db_path)?;
            pool.push_back(conn);
        }
        
        Ok(Self {
            pool: Arc::new(RwLock::new(pool)),
            semaphore: Arc::new(Semaphore::new(max_connections)),
            db_path: db_path.to_string(),
            max_connections,
        })
    }
    
    fn create_connection(db_path: &str) -> Result<Connection> {
        let conn = Connection::open(db_path)?;
        
        // Optimize for multithreading
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -8000;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = memory;
            PRAGMA busy_timeout = 5000;
        ")?;
        
        Ok(conn)
    }
    
    /// Get a connection from the pool
    async fn get_connection(&self) -> Result<Connection> {
        // Acquire semaphore permit
        let _permit = self.semaphore.acquire().await.unwrap();
        
        // Try to get connection from pool
        let mut pool = self.pool.write().await;
        
        if let Some(conn) = pool.pop_front() {
            Ok(conn)
        } else {
            // Create new connection if pool is empty
            Self::create_connection(&self.db_path)
        }
    }
    
    /// Return connection to pool
    async fn return_connection(&self, conn: Connection) {
        let mut pool = self.pool.write().await;
        if pool.len() < self.max_connections {
            pool.push_back(conn);
        }
        // If pool is full, connection is dropped
    }
    
    /// Execute a read-only query with automatic connection management
    async fn execute_read<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T> + Send,
        T: Send,
    {
        let conn = self.get_connection().await?;
        let result = f(&conn);
        self.return_connection(conn).await;
        result
    }
    
    /// Execute a write query with automatic connection management
    async fn execute_write<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T> + Send,
        T: Send,
    {
        let conn = self.get_connection().await?;
        let result = f(&conn);
        self.return_connection(conn).await;
        result
    }
    
    /// Get library stats with parallel queries
    pub async fn get_library_stats_fast(&self) -> Result<LibraryStats> {
        // Execute all queries in parallel
        let (total_books, total_students, active_borrowings, overdue_books) = tokio::join!(
            self.execute_read(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM books WHERE deleted = 0",
                    [],
                    |row| row.get::<_, i32>(0)
                )
            }),
            self.execute_read(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM students WHERE deleted = 0",
                    [],
                    |row| row.get::<_, i32>(0)
                )
            }),
            self.execute_read(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM borrowings WHERE status = 'active'",
                    [],
                    |row| row.get::<_, i32>(0)
                )
            }),
            self.execute_read(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM borrowings WHERE status = 'active' AND due_date < date('now')",
                    [],
                    |row| row.get::<_, i32>(0)
                )
            })
        );

        let total_books_val = total_books.unwrap_or(0);
        let active_borrowings_val = active_borrowings.unwrap_or(0);
        
        Ok(LibraryStats {
            total_books: total_books_val,
            total_students: total_students.unwrap_or(0),
            total_borrowings: active_borrowings_val,
            overdue_books: overdue_books.unwrap_or(0),
            available_books: total_books_val - active_borrowings_val,
            categories_count: 0,
        })
    }
    
    /// Get borrowings with parallel processing
    pub async fn get_borrowings_fast(&self) -> Result<Vec<serde_json::Value>> {
        self.execute_read(|conn| {
            let mut stmt = conn.prepare("
                SELECT 
                    b.id, b.student_id, b.book_id, b.borrowed_date, b.due_date, b.returned_date,
                    b.status, b.fine_amount, b.notes, b.tracking_code, b.borrower_type,
                    s.first_name, s.last_name, s.admission_number, s.class_grade,
                    bk.title, bk.author, bk.isbn,
                    bc.copy_identifier, bc.legacy_book_id
                FROM borrowings b
                LEFT JOIN students s ON b.student_id = s.id
                LEFT JOIN books bk ON b.book_id = bk.id
                LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
                WHERE b.deleted = 0
                ORDER BY b.created_at DESC
                LIMIT 1000
            ")?;

            let borrowings = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "student_id": row.get::<_, Option<String>>(1)?,
                    "book_id": row.get::<_, Option<String>>(2)?,
                    "borrowed_date": row.get::<_, String>(3)?,
                    "due_date": row.get::<_, String>(4)?,
                    "returned_date": row.get::<_, Option<String>>(5)?,
                    "status": row.get::<_, String>(6)?,
                    "fine_amount": row.get::<_, Option<f64>>(7)?,
                    "notes": row.get::<_, Option<String>>(8)?,
                    "tracking_code": row.get::<_, Option<String>>(9)?,
                    "borrower_type": row.get::<_, Option<String>>(10)?,
                    "students": match (row.get::<_, Option<String>>(11)?, row.get::<_, Option<String>>(12)?) {
                        (Some(first), Some(last)) => serde_json::json!({
                            "first_name": first,
                            "last_name": last,
                            "admission_number": row.get::<_, Option<String>>(13)?,
                            "class_grade": row.get::<_, Option<String>>(14)?
                        }),
                        _ => serde_json::Value::Null
                    },
                    "books": match row.get::<_, Option<String>>(15)? {
                        Some(title) => serde_json::json!({
                            "title": title,
                            "author": row.get::<_, Option<String>>(16)?,
                            "isbn": row.get::<_, Option<String>>(17)?
                        }),
                        _ => serde_json::Value::Null
                    },
                    "book_copies": match row.get::<_, Option<String>>(18)? {
                        Some(copy_id) => serde_json::json!({
                            "copy_identifier": copy_id,
                            "legacy_book_id": row.get::<_, Option<i64>>(19)?
                        }),
                        _ => serde_json::Value::Null
                    }
                }))
            })?.collect::<Result<Vec<_>, _>>()?;

            Ok(borrowings)
        }).await
    }
    
    /// Batch insert with transaction
    pub async fn batch_insert_borrowings(&self, borrowings: Vec<Borrowing>) -> Result<usize> {
        self.execute_write(|conn| {
            let tx = conn.unchecked_transaction()?;
            let mut inserted = 0;
            
            for borrowing in borrowings {
                let result = tx.execute(
                    "INSERT OR REPLACE INTO borrowings (
                        id, student_id, book_id, borrowed_date, due_date, status, 
                        fine_amount, notes, tracking_code, borrower_type, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    rusqlite::params![
                        borrowing.id.to_string(),
                        borrowing.student_id.map(|id| id.to_string()),
                        borrowing.book_id.map(|id| id.to_string()),
                        borrowing.borrowed_date.to_string(),
                        borrowing.due_date.to_string(),
                        format!("{:?}", borrowing.status).to_lowercase(),
                        borrowing.fine_amount,
                        borrowing.notes,
                        borrowing.tracking_code,
                        format!("{:?}", borrowing.borrower_type).to_lowercase(),
                        borrowing.created_at.to_rfc3339(),
                        borrowing.updated_at.to_rfc3339(),
                    ],
                );
                
                if result.is_ok() {
                    inserted += 1;
                }
            }
            
            tx.commit()?;
            Ok(inserted)
        }).await
    }
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