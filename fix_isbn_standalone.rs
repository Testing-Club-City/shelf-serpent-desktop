use rusqlite::{Connection, Result};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🔧 Starting ISBN constraint fix...");
    
    // Get the database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    println!("📂 Database path: {:?}", db_path);
    
    if !db_path.exists() {
        println!("❌ Database file not found at: {:?}", db_path);
        return Ok(());
    }
    
    let conn = Connection::open(&db_path)?;
    
    // Check current schema
    let mut stmt = conn.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='books'")?;
    let current_schema: String = stmt.query_row([], |row| row.get(0))?;
    println!("📋 Current books table schema:");
    println!("{}", current_schema);
    
    if current_schema.contains("isbn TEXT UNIQUE") {
        println!("🔧 ISBN constraint found - applying fix...");
        
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
                acquisition_year INTEGER DEFAULT 2024,
                legacy_book_id INTEGER UNIQUE,
                legacy_isbn TEXT,
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0
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
        
        // Verify the change
        let mut stmt = conn.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='books'")?;
        let new_schema: String = stmt.query_row([], |row| row.get(0))?;
        println!("📋 New books table schema:");
        println!("{}", new_schema);
        
        if new_schema.contains("isbn TEXT UNIQUE") {
            println!("❌ Warning: ISBN constraint still appears to be present");
        } else {
            println!("✅ Verified: ISBN unique constraint has been removed");
        }
    } else {
        println!("✅ ISBN constraint already removed or not present");
    }
    
    Ok(())
}
