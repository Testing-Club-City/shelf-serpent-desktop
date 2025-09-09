use sqlx::{SqlitePool, SqliteConnection};
use anyhow::Result;
use std::path::PathBuf;

pub async fn run_schema_migration() -> Result<()> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| anyhow::anyhow!("Failed to get data directory"))?;
    
    let db_path = data_dir
        .join("library-management-system")
        .join("library.db");
    
    // Ensure the parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Correct SQLite URL format (no space after colon)
    let db_url = format!("sqlite:{}", db_path.to_str().unwrap());
    let pool = SqlitePool::connect(&db_url).await?;
    
    println!("Running schema migration...");

    // Clean up any leftover old table from prior partial runs
    sqlx::query("DROP TABLE IF EXISTS book_copies_old").execute(&pool).await?;

    // Drop existing indexes and triggers (safe if not present)
    sqlx::query("DROP TRIGGER IF EXISTS update_book_copies_timestamp").execute(&pool).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_book").execute(&pool).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_status").execute(&pool).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_tracking").execute(&pool).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_sync").execute(&pool).await?;

    // If the column already exists, do nothing (idempotent)
    let (legacy_exists,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('book_copies') WHERE name='legacy_book_id'"
    )
    .fetch_one(&pool)
    .await
    .unwrap_or((0,));

    if legacy_exists > 0 {
        println!("legacy_book_id already exists on book_copies. Nothing to do.");
        pool.close().await;
        return Ok(());
    }

    // Check if current table exists
    let (exists,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='book_copies'"
    )
    .fetch_one(&pool)
    .await?;

    if exists == 0 {
        println!("book_copies not found. Creating fresh table with new schema...");
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS book_copies (
                id BIGINT PRIMARY KEY,
                isbn TEXT NOT NULL,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                publisher TEXT,
                publication_year INTEGER 
                    CHECK (publication_year BETWEEN 1000 AND 2030),
                
                -- Copy-specific details
                copy_identifier TEXT NOT NULL UNIQUE,
                acquisition_date TEXT DEFAULT (date('now')),
                condition TEXT DEFAULT 'good' 
                    CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
                status TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'checked_out', 'lost', 'repair', 'reserved')),
                
                -- Optional tracking fields
                location TEXT,
                department_id INTEGER,
                
                -- Borrowing tracking
                current_borrower_id TEXT,
                borrowed_at TEXT,
                due_date TEXT,
                
                -- Legacy mapping
                legacy_book_id INTEGER,
                
                -- Metadata
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                
                -- Sync fields
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0
            )
        "#).execute(&pool).await?;

        // Create indexes
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_book_copies_isbn ON book_copies(isbn)").execute(&pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_book_copies_borrower ON book_copies(current_borrower_id)").execute(&pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status)").execute(&pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_book_copies_sync ON book_copies(synced, sync_version)").execute(&pool).await?;

        // Trigger
        sqlx::query(r#"
            CREATE TRIGGER IF NOT EXISTS update_book_copies_timestamp
            AFTER UPDATE ON book_copies
            BEGIN
                UPDATE book_copies SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        "#).execute(&pool).await?;

        println!("✅ Fresh schema created successfully");
    } else {
        println!("book_copies found. Adding legacy_book_id column...");
        // Simple in-place migration to avoid rename collisions
        sqlx::query("ALTER TABLE book_copies ADD COLUMN legacy_book_id INTEGER").execute(&pool).await?;

        // Ensure trigger exists (safe if it already does nothing harmful)
        sqlx::query(r#"
            CREATE TRIGGER IF NOT EXISTS update_book_copies_timestamp
            AFTER UPDATE ON book_copies
            BEGIN
                UPDATE book_copies SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        "#).execute(&pool).await?;

        println!("✅ Column added successfully");
    }
    
    pool.close().await;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    run_schema_migration().await?;
    Ok(())
}
