// Fix borrowing data by updating book_id references
use rusqlite::{Connection, Result};

pub async fn fix_borrowing_book_references() -> Result<()> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    let conn = Connection::open(&db_path)?;
    
    println!("🔧 Fixing borrowing book references...");
    
    // Update borrowings that have book_copy_id but missing or incorrect book_id
    let update_query = r#"
        UPDATE borrowings 
        SET book_id = (
            SELECT bc.book_id 
            FROM book_copies bc 
            WHERE bc.id = borrowings.book_copy_id
            AND bc.book_id IS NOT NULL
        )
        WHERE book_copy_id IS NOT NULL 
        AND (book_id IS NULL OR book_id NOT IN (SELECT id FROM books))
    "#;
    
    let updated_rows = conn.execute(update_query, [])?;
    println!("✅ Updated {} borrowing records with correct book_id", updated_rows);
    
    // For borrowings that still don't have book_id, try to create book records from book_copies
    let create_books_query = r#"
        INSERT OR IGNORE INTO books (
            id, title, author, isbn, publisher, publication_year,
            total_copies, available_copies, created_at, updated_at
        )
        SELECT 
            COALESCE(bc.book_id, bc.id) as id,
            bc.title,
            bc.author,
            bc.isbn,
            bc.publisher,
            bc.publication_year,
            1 as total_copies,
            0 as available_copies,
            datetime('now') as created_at,
            datetime('now') as updated_at
        FROM book_copies bc
        WHERE bc.id IN (
            SELECT DISTINCT book_copy_id 
            FROM borrowings 
            WHERE book_copy_id IS NOT NULL 
            AND (book_id IS NULL OR book_id NOT IN (SELECT id FROM books))
        )
        AND bc.title IS NOT NULL 
        AND bc.title != 'Unknown Title'
    "#;
    
    let created_books = conn.execute(create_books_query, [])?;
    println!("✅ Created {} book records from book_copies data", created_books);
    
    // Update borrowings again after creating books
    let final_update = conn.execute(update_query, [])?;
    println!("✅ Final update: {} borrowing records fixed", final_update);
    
    // Report on remaining issues
    let remaining_issues: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrowings WHERE book_id IS NULL AND book_copy_id IS NOT NULL",
        [],
        |row| row.get(0)
    )?;
    
    if remaining_issues > 0 {
        println!("⚠️ {} borrowings still have missing book_id", remaining_issues);
    } else {
        println!("✅ All borrowings now have proper book references");
    }
    
    Ok(())
}