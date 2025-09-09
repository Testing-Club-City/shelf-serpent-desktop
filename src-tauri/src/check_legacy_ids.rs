use rusqlite::{Connection, Result};
use std::path::Path;

fn main() -> Result<()> {
    // Get the database path
    let db_path = Path::new("../../shelf-serpent.db");
    
    if !db_path.exists() {
        println!("Database not found at: {:?}", db_path);
        return Ok(());
    }

    let conn = Connection::open(db_path)?;

    // Check books table for legacy book IDs
    println!("=== BOOKS WITH LEGACY IDs ===");
    let mut stmt = conn.prepare("SELECT id, title, legacy_book_id, legacy_isbn FROM books WHERE legacy_book_id IS NOT NULL LIMIT 10")?;
    let book_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i32>>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    })?;

    let mut book_count = 0;
    for book in book_iter {
        let (id, title, legacy_id, legacy_isbn) = book?;
        println!("Book ID: {}", id);
        println!("Title: {}", title);
        println!("Legacy Book ID: {:?}", legacy_id);
        println!("Legacy ISBN: {:?}", legacy_isbn);
        println!("---");
        book_count += 1;
    }

    if book_count == 0 {
        println!("No books found with legacy_book_id");
    }

    // Check book_copies table for legacy book IDs
    println!("\n=== BOOK COPIES WITH LEGACY IDs ===");
    let mut stmt = conn.prepare("SELECT id, title, legacy_book_id FROM book_copies WHERE legacy_book_id IS NOT NULL LIMIT 10")?;
    let copy_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i32>>(2)?,
        ))
    })?;

    let mut copy_count = 0;
    for copy in copy_iter {
        let (id, title, legacy_id) = copy?;
        println!("Copy ID: {}", id);
        println!("Title: {}", title);
        println!("Legacy Book ID: {:?}", legacy_id);
        println!("---");
        copy_count += 1;
    }

    if copy_count == 0 {
        println!("No book copies found with legacy_book_id");
    }

    // Show table schemas
    println!("\n=== TABLE SCHEMAS ===");
    let mut stmt = conn.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('books', 'book_copies')")?;
    let schema_iter = stmt.query_map([], |row| row.get::<_, String>(0))?;

    for schema in schema_iter {
        println!("Schema: {}", schema?);
    }

    Ok(())
}
