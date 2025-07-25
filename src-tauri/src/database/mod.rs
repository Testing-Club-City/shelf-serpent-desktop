use crate::models::*;
use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use chrono::{DateTime, Utc};

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
        let conn = Connection::open(db_path)?;
        
        // Run the schema creation
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;
        
        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
        })
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
}
