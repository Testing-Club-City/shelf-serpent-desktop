use crate::models::*;
use rusqlite::{Connection, Result, params};
use std::sync::{Arc, Mutex};
use tokio::task;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// Helper functions for row conversion
#[allow(dead_code)]
fn row_to_book(row: &rusqlite::Row) -> rusqlite::Result<Book> {
    let id_str: String = row.get(0)?;
    let category_id_str: Option<String> = row.get(6)?;
    let created_str: String = row.get(11)?;
    let updated_str: String = row.get(12)?;
    
    Ok(Book {
        id: Uuid::parse_str(&id_str).unwrap(),
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
        book_code: None,
        acquisition_year: None,
        legacy_book_id: None,
        legacy_isbn: None,
        created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
        updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
    })
}

#[allow(dead_code)]
fn row_to_student(row: &rusqlite::Row) -> rusqlite::Result<Student> {
    let id_str: String = row.get(0)?;
    let class_id_str: Option<String> = row.get(13)?;
    let created_str: String = row.get(11)?;
    let updated_str: String = row.get(12)?;
    let enrollment_str: String = row.get(9)?;
    let birth_str: Option<String> = row.get(8)?;
    
    Ok(Student {
        id: Uuid::parse_str(&id_str).unwrap(),
        admission_number: row.get(1)?,
        first_name: row.get(2)?,
        last_name: row.get(3)?,
        email: row.get(4)?,
        phone: row.get(5)?,
        class_grade: row.get(6)?,
        address: row.get(7)?,
        date_of_birth: birth_str.and_then(|s| chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok()),
        enrollment_date: chrono::NaiveDate::parse_from_str(&enrollment_str, "%Y-%m-%d").unwrap(),
        status: "active".to_string(),
        created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
        updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
        class_id: class_id_str.and_then(|s| Uuid::parse_str(&s).ok()),
        academic_year: row.get(14)?,
        is_repeating: row.get::<_, i32>(15)? == 1,
        legacy_student_id: row.get(16)?,
    })
}

#[allow(dead_code)]
pub struct OptimizedDatabaseManager {
    connection: Arc<Mutex<Connection>>,
    #[allow(dead_code)]
    read_pool: Arc<Mutex<Vec<Connection>>>,
}

#[allow(dead_code)]
impl OptimizedDatabaseManager {
    #[allow(dead_code)]
    pub fn new(db_path: &str) -> Result<Self> {
        let main_conn = Connection::open(db_path)?;
        
        // Create the schema
        let schema = include_str!("schema.sql");
        main_conn.execute_batch(schema)?;
        
        // Create read-only connection pool for parallel reads
        let mut read_pool = Vec::new();
        for _ in 0..4 { // 4 read connections
            let read_conn = Connection::open(db_path)?;
            // Enable WAL mode for better concurrency
            read_conn.pragma_update(None, "journal_mode", "WAL")?;
            read_conn.pragma_update(None, "synchronous", "NORMAL")?;
            read_conn.pragma_update(None, "cache_size", "10000")?;
            read_conn.pragma_update(None, "temp_store", "MEMORY")?;
            read_pool.push(read_conn);
        }
        
        // Configure main connection for optimal performance
        main_conn.pragma_update(None, "journal_mode", "WAL")?;
        main_conn.pragma_update(None, "synchronous", "NORMAL")?;
        main_conn.pragma_update(None, "cache_size", "10000")?;
        main_conn.pragma_update(None, "temp_store", "MEMORY")?;
        
        Ok(Self {
            connection: Arc::new(Mutex::new(main_conn)),
            read_pool: Arc::new(Mutex::new(read_pool)),
        })
    }

    /// Get a read-only connection from the pool
    fn get_read_connection(&self) -> Result<Connection> {
        let mut pool = self.read_pool.lock().unwrap();
        if let Some(conn) = pool.pop() {
            Ok(conn)
        } else {
            // If pool is empty, create a new connection
            let conn = Connection::open(&self.get_db_path()?)?;
            conn.pragma_update(None, "journal_mode", "WAL")?;
            conn.pragma_update(None, "synchronous", "NORMAL")?;
            Ok(conn)
        }
    }

    /// Return connection to pool
    fn return_read_connection(&self, conn: Connection) {
        let mut pool = self.read_pool.lock().unwrap();
        if pool.len() < 8 { // Don't let pool grow too large
            pool.push(conn);
        }
    }

    /// Get database path (simplified for this example)
    fn get_db_path(&self) -> Result<String> {
        Ok("library.db".to_string())
    }

    /// Fast batch insert for large datasets
    pub async fn batch_insert_books(&self, books: Vec<Book>) -> Result<usize> {
        let conn = self.connection.clone();
        
        task::spawn_blocking(move || {
            let conn = conn.lock().unwrap();
            let tx = conn.unchecked_transaction()?;
            
            let mut inserted = 0;
            {
                let mut stmt = tx.prepare(
                    "INSERT OR REPLACE INTO books 
                     (id, title, author, isbn, publisher, publication_year, category_id, 
                      total_copies, available_copies, shelf_location, description, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
                )?;
                
                for book in &books {
                    stmt.execute(params![
                        book.id.to_string(),
                        book.title,
                        book.author,
                        book.isbn,
                        book.publisher,
                        book.publication_year,
                        book.category_id.map(|id| id.to_string()),
                        book.total_copies,
                        book.available_copies,
                        book.shelf_location,
                        book.description,
                        book.created_at.to_rfc3339(),
                        book.updated_at.to_rfc3339(),
                    ])?;
                    inserted += 1;
                }
            } // stmt is dropped here
            
            tx.commit()?;
            Ok(inserted)
        }).await.unwrap()
    }

    /// Parallel search across multiple tables
    pub async fn parallel_search(&self, query: &str, limit: usize) -> Result<SearchResults> {
        let query = query.to_lowercase();
        let search_pattern = format!("%{}%", query);
        
        // Create multiple search tasks
        let books_task = {
            let pattern = search_pattern.clone();
            let db_path = self.get_db_path()?;
            
            task::spawn_blocking(move || -> Result<Vec<Book>> {
                let conn = Connection::open(db_path)?;
                let mut stmt = conn.prepare(
                    "SELECT id, title, author, isbn, publisher, publication_year, category_id, 
                            total_copies, available_copies, shelf_location, description, created_at, updated_at
                     FROM books 
                     WHERE deleted = 0 AND (
                         LOWER(title) LIKE ?1 OR 
                         LOWER(author) LIKE ?1 OR 
                         LOWER(isbn) LIKE ?1 OR
                         LOWER(publisher) LIKE ?1
                     )
                     ORDER BY title
                     LIMIT ?2"
                )?;
                
                let books: Result<Vec<Book>> = stmt.query_map(params![pattern, limit], |row| {
                    row_to_book(row)
                })?.collect();
                
                books
            })
        };

        let students_task = {
            let pattern = search_pattern.clone();
            let db_path = self.get_db_path()?;
            
            task::spawn_blocking(move || -> Result<Vec<Student>> {
                let conn = Connection::open(db_path)?;
                let mut stmt = conn.prepare(
                    "SELECT id, admission_number, first_name, last_name, email, phone, 
                            class_grade, address, date_of_birth, enrollment_date, status, 
                            created_at, updated_at, class_id, academic_year, is_repeating, legacy_student_id
                     FROM students 
                     WHERE deleted = 0 AND (
                         LOWER(first_name) LIKE ?1 OR 
                         LOWER(last_name) LIKE ?1 OR 
                         LOWER(admission_number) LIKE ?1 OR
                         LOWER(email) LIKE ?1
                     )
                     ORDER BY first_name, last_name
                     LIMIT ?2"
                )?;
                
                let students: Result<Vec<Student>> = stmt.query_map(params![pattern, limit], |row| {
                    row_to_student(row)
                })?.collect();
                
                students
            })
        };

        // Wait for all searches to complete
        let (books_result, students_result) = tokio::join!(books_task, students_task);
        
        let books = books_result.unwrap()?;
        let students = students_result.unwrap()?;
        
        let total_books = books.len();
        let total_students = students.len();
        
        Ok(SearchResults {
            books,
            students,
            total_books,
            total_students,
        })
    }

    /// Optimized pagination for large datasets
    pub async fn get_books_paginated(&self, page: usize, page_size: usize, filters: BookFilters) -> Result<PaginatedBooks> {
        let offset = page * page_size;
        
        let conn_clone = self.connection.clone();
        
        task::spawn_blocking(move || {
            let conn = conn_clone.lock().unwrap();
            
            // Build dynamic query based on filters
            let mut query = String::from(
                "SELECT id, title, author, isbn, publisher, publication_year, category_id, 
                        total_copies, available_copies, shelf_location, description, created_at, updated_at
                 FROM books WHERE deleted = 0"
            );
            
            let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            let mut param_index = 1;
            
            if let Some(category_id) = filters.category_id {
                query.push_str(&format!(" AND category_id = ?{}", param_index));
                params.push(Box::new(category_id.to_string()));
                param_index += 1;
            }
            
            if let Some(status) = filters.status {
                query.push_str(&format!(" AND status = ?{}", param_index));
                params.push(Box::new(status));
                param_index += 1;
            }
            
            if let Some(search) = filters.search {
                query.push_str(&format!(" AND (LOWER(title) LIKE ?{} OR LOWER(author) LIKE ?{})", param_index, param_index + 1));
                let search_pattern = format!("%{}%", search.to_lowercase());
                params.push(Box::new(search_pattern.clone()));
                params.push(Box::new(search_pattern));
                // param_index += 2; // Not used after this
            }
            
            // Add ordering and pagination
            query.push_str(&format!(" ORDER BY title LIMIT {} OFFSET {}", page_size, offset));
            
            // Count total records
            let count_query = query.replace("SELECT id, title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, shelf_location, description, created_at, updated_at", "SELECT COUNT(*)");
            let count_query = count_query.replace(&format!(" LIMIT {} OFFSET {}", page_size, offset), "");
            
            let total_count: i64 = if params.is_empty() {
                conn.query_row(&count_query, [], |row| row.get(0))?
            } else {
                let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
                conn.query_row(&count_query, &param_refs[..], |row| row.get(0))?
            };
            
            // Execute main query
            let mut stmt = conn.prepare(&query)?;
                let books: Result<Vec<Book>> = if params.is_empty() {
                    stmt.query_map([], |row| row_to_book(row))?.collect()
                } else {
                    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
                    stmt.query_map(&param_refs[..], |row| row_to_book(row))?.collect()
                };            let books = books?;
            let total_pages = ((total_count as f64) / (page_size as f64)).ceil() as usize;
            
            Ok(PaginatedBooks {
                books,
                current_page: page,
                page_size,
                total_count: total_count as usize,
                total_pages,
                has_next: page < total_pages - 1,
                has_previous: page > 0,
            })
        }).await.unwrap()
    }

    /// Batch operations for improved performance
    pub async fn execute_batch_operations(&self, operations: Vec<BatchOperation>) -> Result<BatchResult> {
        let conn = self.connection.clone();
        
        task::spawn_blocking(move || {
            let conn = conn.lock().unwrap();
            let tx = conn.unchecked_transaction()?;
            
            let mut successful = 0;
            let mut failed = 0;
            let mut errors = Vec::new();
            
            for operation in operations {
                match operation {
                    BatchOperation::InsertBook(book) => {
                        let result = tx.execute(
                            "INSERT INTO books (id, title, author, isbn, publisher, publication_year, 
                                               category_id, total_copies, available_copies, shelf_location, 
                                               description, created_at, updated_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                            params![
                                book.id.to_string(),
                                book.title,
                                book.author,
                                book.isbn,
                                book.publisher,
                                book.publication_year,
                                book.category_id.map(|id| id.to_string()),
                                book.total_copies,
                                book.available_copies,
                                book.shelf_location,
                                book.description,
                                book.created_at.to_rfc3339(),
                                book.updated_at.to_rfc3339(),
                            ]
                        );
                        
                        match result {
                            Ok(_) => successful += 1,
                            Err(e) => {
                                failed += 1;
                                errors.push(format!("Failed to insert book {}: {}", book.title, e));
                            }
                        }
                    },
                    BatchOperation::UpdateBook(book) => {
                        let result = tx.execute(
                            "UPDATE books SET title = ?2, author = ?3, isbn = ?4, publisher = ?5, 
                                            publication_year = ?6, category_id = ?7, total_copies = ?8, 
                                            available_copies = ?9, shelf_location = ?10, description = ?11, 
                                            updated_at = ?12
                             WHERE id = ?1",
                            params![
                                book.id.to_string(),
                                book.title,
                                book.author,
                                book.isbn,
                                book.publisher,
                                book.publication_year,
                                book.category_id.map(|id| id.to_string()),
                                book.total_copies,
                                book.available_copies,
                                book.shelf_location,
                                book.description,
                                book.updated_at.to_rfc3339(),
                            ]
                        );
                        
                        match result {
                            Ok(_) => successful += 1,
                            Err(e) => {
                                failed += 1;
                                errors.push(format!("Failed to update book {}: {}", book.title, e));
                            }
                        }
                    },
                    // Add more batch operations as needed
                }
            }
            
            tx.commit()?;
            
            Ok(BatchResult {
                successful,
                failed,
                errors,
            })
        }).await.unwrap()
    }
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct SearchResults {
    pub books: Vec<Book>,
    pub students: Vec<Student>,
    pub total_books: usize,
    pub total_students: usize,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct BookFilters {
    pub category_id: Option<uuid::Uuid>,
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct PaginatedBooks {
    pub books: Vec<Book>,
    pub current_page: usize,
    pub page_size: usize,
    pub total_count: usize,
    pub total_pages: usize,
    pub has_next: bool,
    pub has_previous: bool,
}

#[derive(Debug)]
#[allow(dead_code)]
pub enum BatchOperation {
    InsertBook(Book),
    UpdateBook(Book),
    // Add more operations as needed
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct BatchResult {
    pub successful: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}
