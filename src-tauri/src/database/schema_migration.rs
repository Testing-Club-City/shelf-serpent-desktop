use sqlx::{SqlitePool, SqliteConnection};
use anyhow::Result;

pub async fn migrate_book_copies_schema(pool: &SqlitePool) -> Result<()> {
    println!("🔄 Starting book_copies schema migration...");
    
    // Start transaction
    let mut conn = pool.acquire().await?;
    let mut tx = conn.begin().await?;
    
    // Drop existing indexes and triggers
    sqlx::query("DROP TRIGGER IF EXISTS update_book_copies_timestamp").execute(&mut *tx).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_book").execute(&mut *tx).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_status").execute(&mut *tx).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_tracking").execute(&mut *tx).await?;
    sqlx::query("DROP INDEX IF EXISTS idx_book_copies_sync").execute(&mut *tx).await?;
    
    // Rename old table
    sqlx::query("ALTER TABLE book_copies RENAME TO book_copies_old").execute(&mut *tx).await?;
    
    // Create new table with updated schema
    sqlx::query(r#"
        CREATE TABLE book_copies (
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
    "#).execute(&mut *tx).await?;
    
    // Create indexes
    sqlx::query("CREATE INDEX idx_book_copies_isbn ON book_copies(isbn)").execute(&mut *tx).await?;
    sqlx::query("CREATE INDEX idx_book_copies_borrower ON book_copies(current_borrower_id)").execute(&mut *tx).await?;
    sqlx::query("CREATE INDEX idx_book_copies_status ON book_copies(status)").execute(&mut *tx).await?;
    sqlx::query("CREATE INDEX idx_book_copies_sync ON book_copies(synced, sync_version)").execute(&mut *tx).await?;
    
    // Create trigger for updated_at
    sqlx::query(r#"
        CREATE TRIGGER update_book_copies_timestamp
        AFTER UPDATE ON book_copies
        BEGIN
            UPDATE book_copies SET updated_at = datetime('now') WHERE id = NEW.id;
        END
    "#).execute(&mut *tx).await?;
    
    // Data migration - map old fields to new schema
    sqlx::query(r#"
        INSERT INTO book_copies (
            id, isbn, title, author, publisher, copy_identifier, 
            condition, status, location, legacy_book_id, created_at, updated_at
        )
        SELECT 
            CAST(COALESCE(legacy_book_id, 0) AS INTEGER) as id,
            COALESCE(book_code, '') as isbn,
            COALESCE(book_code, '') as title,
            COALESCE(book_code, '') as author,
            NULL as publisher,
            COALESCE(tracking_code, '') as copy_identifier,
            COALESCE(condition, 'good') as condition,
            CASE 
                WHEN status = 'available' THEN 'available'
                WHEN status = 'borrowed' THEN 'checked_out'
                WHEN status = 'maintenance' THEN 'repair'
                WHEN status = 'lost' THEN 'lost'
                WHEN status = 'stolen' THEN 'lost'
                ELSE 'available'
            END as status,
            NULL as location,
            legacy_book_id,
            COALESCE(created_at, datetime('now')) as created_at,
            COALESCE(updated_at, datetime('now')) as updated_at
        FROM book_copies_old
    "#).execute(&mut *tx).await?;
    
    // Drop old table
    sqlx::query("DROP TABLE IF EXISTS book_copies_old").execute(&mut *tx).await?;
    
    // Commit transaction
    tx.commit().await?;
    
    println!("✅ book_copies schema migration completed successfully");
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    
    #[tokio::test]
    async fn test_migration() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        
        // Create old table for testing
        sqlx::query(r#"
            CREATE TABLE book_copies (
                id TEXT PRIMARY KEY,
                book_id TEXT,
                copy_number INTEGER,
                book_code TEXT,
                condition TEXT,
                status TEXT,
                created_at TEXT,
                updated_at TEXT,
                tracking_code TEXT UNIQUE,
                notes TEXT,
                legacy_book_id INTEGER,
                synced INTEGER DEFAULT 0,
                sync_version INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0
            )
        "#).execute(&pool).await.unwrap();
        
        // Run migration
        migrate_book_copies_schema(&pool).await.unwrap();
        
        // Verify new table exists
        let result = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='book_copies'")
            .fetch_one(&pool)
            .await
            .unwrap();
        
        assert_eq!(result.get::<String, _>("name"), "book_copies");
    }
}
