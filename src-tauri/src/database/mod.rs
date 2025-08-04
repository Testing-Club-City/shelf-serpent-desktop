use crate::models::*;
use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub mod optimized;

pub struct DatabaseManager {
    connection: Arc<Mutex<Connection>>,
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
        let mut conn = Connection::open(db_path)?;
        
        // Enable performance optimizations
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = memory;
            PRAGMA mmap_size = 268435456;
        ")?;
        
        // Run the schema creation
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;
        
        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
        })
    }

    /// Get a reference to the connection for direct database operations
    pub fn get_connection(&self) -> &Arc<Mutex<Connection>> {
        &self.connection
    }

    pub async fn create_book(&self, book: &Book) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO books (id, title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, shelf_location, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            (
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
                book.created_at.to_rfc3339(),
                book.updated_at.to_rfc3339(),
            ),
        )?;
        Ok(())
    }

    pub async fn get_books(&self) -> Result<Vec<Book>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, shelf_location, description, created_at, updated_at 
             FROM books WHERE deleted = 0 ORDER BY title"
        )?;

        let books = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let category_id_str: Option<String> = row.get(6)?;
            let created_str: String = row.get(11)?;
            let updated_str: String = row.get(12)?;
            
            Ok(Book {
                id: Uuid::parse_str(&id_str).unwrap(),
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
                book_code: None,
                acquisition_year: None,
                legacy_book_id: None,
                legacy_isbn: None,
                created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(books)
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

    pub async fn search_books(&self, query: &str) -> Result<Vec<Book>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, shelf_location, description, created_at, updated_at 
             FROM books 
             WHERE deleted = 0 AND (title LIKE ?1 OR author LIKE ?1 OR isbn LIKE ?1)
             ORDER BY title"
        )?;

        let search_pattern = format!("%{}%", query);
        let books = stmt.query_map([&search_pattern], |row| {
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
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(books)
    }

    pub async fn get_categories(&self) -> Result<Vec<Category>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at 
             FROM categories WHERE deleted = 0 ORDER BY name"
        )?;

        let categories = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let created_str: String = row.get(3)?;
            let updated_str: String = row.get(4)?;
            
            Ok(Category {
                id: Uuid::parse_str(&id_str).unwrap(),
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(categories)
    }

    pub async fn create_category(&self, category: &Category) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (id, name, description, created_at, updated_at)
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

    pub async fn get_students(&self) -> Result<Vec<Student>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, first_name, last_name, admission_number, class_id, email, phone, address, created_at, updated_at 
             FROM students WHERE deleted = 0 ORDER BY first_name, last_name"
        )?;

        let students = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let class_id_str: Option<String> = row.get(4)?;
            let created_str: String = row.get(8)?;
            let updated_str: String = row.get(9)?;
            
            Ok(Student {
                id: Uuid::parse_str(&id_str).unwrap(),
                admission_number: row.get(3)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                email: row.get(5)?,
                phone: row.get(6)?,
                class_grade: "Unknown".to_string(), // Default value
                address: row.get(7)?,
                date_of_birth: None, // Not in simplified schema
                enrollment_date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(), // Default
                status: "Active".to_string(), // Default
                created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
                class_id: class_id_str.and_then(|s| Uuid::parse_str(&s).ok()),
                academic_year: "2024".to_string(), // Default
                is_repeating: false, // Default
                legacy_student_id: None,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(students)
    }

    pub async fn create_student(&self, student: &Student) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO students (id, first_name, last_name, admission_number, class_id, email, phone, address, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (
                student.id.to_string(),
                &student.first_name,
                &student.last_name,
                &student.admission_number,
                student.class_id.map(|id| id.to_string()),
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
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE books SET title = ?2, author = ?3, isbn = ?4, publisher = ?5, publication_year = ?6, 
             category_id = ?7, total_copies = ?8, available_copies = ?9, shelf_location = ?10, 
             description = ?11, updated_at = ?12 WHERE id = ?1",
            (
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
                book.updated_at.to_rfc3339(),
            ),
        )?;
        Ok(())
    }

    pub async fn update_student(&self, student: &Student) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE students SET first_name = ?2, last_name = ?3, admission_number = ?4, 
             class_id = ?5, email = ?6, phone = ?7, address = ?8, updated_at = ?9 WHERE id = ?1",
            (
                student.id.to_string(),
                &student.first_name,
                &student.last_name,
                &student.admission_number,
                student.class_id.map(|id| id.to_string()),
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
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE books SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [book_id],
        )?;
        Ok(())
    }

    pub async fn delete_student(&self, student_id: &str) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE students SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [student_id],
        )?;
        Ok(())
    }

    pub async fn get_library_stats(&self) -> Result<LibraryStats> {
        let conn = self.connection.lock().unwrap();
        
        let total_books: i32 = conn.query_row(
            "SELECT COUNT(*) FROM books WHERE deleted = 0",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        let total_students: i32 = conn.query_row(
            "SELECT COUNT(*) FROM students WHERE deleted = 0",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        let active_borrowings: i32 = conn.query_row(
            "SELECT COUNT(*) FROM borrowings WHERE status = 'borrowed'",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        let overdue_books: i32 = conn.query_row(
            "SELECT COUNT(*) FROM borrowings WHERE status = 'borrowed' AND due_date < date('now')",
            [],
            |row| row.get(0)
        ).unwrap_or(0);

        Ok(LibraryStats {
            total_books,
            total_students,
            total_borrowings: active_borrowings,
            overdue_books,
            available_books: total_books - active_borrowings,
            categories_count: 0, // Will implement later
        })
    }

    // Session Management for Offline Authentication
    pub async fn save_user_session(&self, session: &UserSession) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        
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
        let conn = self.connection.lock().unwrap();
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
                expires_at: DateTime::parse_from_rfc3339(&expires_str).unwrap().with_timezone(&Utc),
                user_metadata: row.get(6)?,
                role: row.get(7)?,
                created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
                last_activity: DateTime::parse_from_rfc3339(&activity_str).unwrap().with_timezone(&Utc),
                session_valid: row.get::<_, i32>(11)? == 1,
                offline_expiry: DateTime::parse_from_rfc3339(&offline_expiry_str).unwrap().with_timezone(&Utc),
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
        let conn = self.connection.lock().unwrap();
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
                expires_at: DateTime::parse_from_rfc3339(&expires_str).unwrap().with_timezone(&Utc),
                user_metadata: row.get(6)?,
                role: row.get(7)?,
                created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
                last_activity: DateTime::parse_from_rfc3339(&activity_str).unwrap().with_timezone(&Utc),
                session_valid: row.get::<_, i32>(11)? == 1,
                offline_expiry: DateTime::parse_from_rfc3339(&offline_expiry_str).unwrap().with_timezone(&Utc),
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
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE user_sessions SET last_activity = datetime('now'), updated_at = datetime('now') 
             WHERE user_id = ?1 AND session_valid = 1",
            [user_id],
        )?;
        Ok(())
    }

    pub async fn invalidate_user_session(&self, user_id: &str) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE user_sessions SET session_valid = 0, updated_at = datetime('now') WHERE user_id = ?1",
            [user_id],
        )?;
        Ok(())
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "DELETE FROM user_sessions WHERE offline_expiry < datetime('now', '-7 days')",
            [],
        )?;
        Ok(())
    }

    // Staff management methods
    #[allow(dead_code)]
    pub async fn get_staff(&self) -> Result<Vec<Staff>> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, staff_id, first_name, last_name, email, phone, department, position, status, created_at, updated_at, legacy_staff_id 
             FROM staff WHERE deleted = 0 ORDER BY first_name, last_name"
        )?;

        let staff = stmt.query_map([], |row| {
            let id_str: String = row.get(0)?;
            let created_str: String = row.get(9)?;
            let updated_str: String = row.get(10)?;
            
            Ok(Staff {
                id: Uuid::parse_str(&id_str).unwrap(),
                staff_id: row.get(1)?,
                first_name: row.get(2)?,
                last_name: row.get(3)?,
                email: row.get(4)?,
                phone: row.get(5)?,
                department: row.get(6)?,
                position: row.get(7)?,
                status: row.get(8)?,
                created_at: DateTime::parse_from_rfc3339(&created_str).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&updated_str).unwrap().with_timezone(&Utc),
                legacy_staff_id: row.get(11)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(staff)
    }

    #[allow(dead_code)]
    pub async fn create_staff(&self, staff: &Staff) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO staff (id, staff_id, first_name, last_name, email, phone, department, position, status, created_at, updated_at, legacy_staff_id)
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
        let conn = self.connection.lock().unwrap();
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
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "UPDATE staff SET deleted = 1, updated_at = datetime('now') WHERE id = ?1",
            [staff_id],
        )?;
        Ok(())
    }

    // Book copy management methods
    #[allow(dead_code)]
    pub async fn create_book_copy(&self, book_copy: &crate::models::BookCopy) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO book_copies (id, book_id, copy_number, book_code, condition, status, 
             created_at, updated_at, tracking_code, notes, legacy_book_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            (
                book_copy.id.to_string(),
                book_copy.book_id.map(|id| id.to_string()),
                book_copy.copy_number,
                &book_copy.book_code,
                format!("{:?}", book_copy.condition).to_lowercase(),
                format!("{:?}", book_copy.status).to_lowercase(),
                book_copy.created_at.to_rfc3339(),
                book_copy.updated_at.to_rfc3339(),
                &book_copy.tracking_code,
                &book_copy.notes,
                &book_copy.legacy_book_id,
            ),
        )?;
        Ok(())
    }

    // Borrowing management methods
    #[allow(dead_code)]
    pub async fn create_borrowing(&self, borrowing: &crate::models::Borrowing) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        conn.execute(
            "INSERT INTO borrowings (id, student_id, book_id, borrowed_date, due_date, returned_date,
             status, fine_amount, notes, issued_by, returned_by, created_at, updated_at, fine_paid,
             book_copy_id, condition_at_issue, condition_at_return, is_lost, tracking_code,
             return_notes, copy_condition, group_borrowing_id, borrower_type, staff_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            rusqlite::params![
                borrowing.id.to_string(),
                borrowing.student_id.map(|id| id.to_string()),
                borrowing.book_id.map(|id| id.to_string()),
                borrowing.borrowed_date.to_string(),
                borrowing.due_date.to_string(),
                borrowing.returned_date.map(|d| d.to_string()),
                format!("{:?}", borrowing.status).to_lowercase(),
                borrowing.fine_amount,
                &borrowing.notes,
                borrowing.issued_by.map(|id| id.to_string()),
                borrowing.returned_by.map(|id| id.to_string()),
                borrowing.created_at.to_rfc3339(),
                borrowing.updated_at.to_rfc3339(),
                borrowing.fine_paid,
                borrowing.book_copy_id.map(|id| id.to_string()),
                &borrowing.condition_at_issue,
                &borrowing.condition_at_return,
                borrowing.is_lost,
                &borrowing.tracking_code,
                &borrowing.return_notes,
                &borrowing.copy_condition,
                borrowing.group_borrowing_id.map(|id| id.to_string()),
                format!("{:?}", borrowing.borrower_type).to_lowercase(),
                borrowing.staff_id.map(|id| id.to_string()),
            ],
        )?;
        Ok(())
    }

    // Fine management methods
    #[allow(dead_code)]
    pub async fn create_fine(&self, fine: &crate::models::Fine) -> Result<()> {
        let conn = self.connection.lock().unwrap();
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
    pub async fn get_books_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM books")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_students_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM students")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_categories_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM categories")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_borrowings_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM borrowings")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_book_copies_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM book_copies")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_staff_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM staff")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_classes_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM classes")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_fines_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM fines")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_fine_settings_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM fine_settings")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_group_borrowings_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM group_borrowings")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn get_theft_reports_count(&self) -> Result<i32> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM theft_reports")?;
        let count: i32 = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub async fn clear_all_tables(&self) -> Result<()> {
        let conn = self.connection.lock().unwrap();
        
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

    // Optimized bulk count function for better performance
    pub async fn get_all_counts_optimized(&self) -> Result<std::collections::HashMap<String, i32>> {
        let conn = self.connection.lock().unwrap();
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
}
