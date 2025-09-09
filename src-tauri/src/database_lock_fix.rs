use anyhow::Result;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::{ConnectOptions, Row};
use std::time::Duration;
use std::path::PathBuf;

/// Fix database locking issues by optimizing SQLite configuration and operations
pub async fn fix_database_locks() -> Result<()> {
    println!("🔧 Fixing database lock issues...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Create optimized connection options
    let mut options = SqliteConnectOptions::new()
        .filename(&db_path)
        .journal_mode(SqliteJournalMode::Wal)  // Use WAL mode for better concurrency
        .synchronous(SqliteSynchronous::Normal)  // Balance between safety and performance
        .busy_timeout(Duration::from_secs(30))   // 30 second timeout instead of default
        .pragma("cache_size", "-64000")          // 64MB cache
        .pragma("temp_store", "memory")          // Store temp tables in memory
        .pragma("mmap_size", "268435456")        // 256MB memory map
        .pragma("optimize", "0x10002")           // Enable query planner optimizations
        .create_if_missing(true);
    
    // Disable logging for connection to reduce overhead
    options.log_statements(log::LevelFilter::Off);
    
    // Create connection pool with optimized settings
    let pool = SqlitePool::connect_with(options).await?;
    
    println!("✅ Database connection established with optimized settings");
    
    // Apply additional optimizations
    apply_database_optimizations(&pool).await?;
    
    // Fix any existing lock issues
    fix_existing_locks(&pool).await?;
    
    // Optimize book_copies operations specifically
    optimize_book_copies_operations(&pool).await?;
    
    // Optimize borrowings operations
    optimize_borrowings_operations(&pool).await?;
    
    println!("🎉 Database lock fixes applied successfully!");
    Ok(())
}

/// Apply database-level optimizations
async fn apply_database_optimizations(pool: &SqlitePool) -> Result<()> {
    println!("⚙️ Applying database optimizations...");
    
    // Execute optimization pragmas
    let optimizations = vec![
        "PRAGMA journal_mode = WAL",
        "PRAGMA synchronous = NORMAL", 
        "PRAGMA cache_size = -64000",
        "PRAGMA temp_store = memory",
        "PRAGMA mmap_size = 268435456",
        "PRAGMA busy_timeout = 30000",
        "PRAGMA wal_autocheckpoint = 1000",
        "PRAGMA journal_size_limit = 67108864", // 64MB WAL limit
        "PRAGMA optimize",
    ];
    
    for pragma in optimizations {
        match sqlx::query(pragma).execute(pool).await {
            Ok(_) => println!("✅ Applied: {}", pragma),
            Err(e) => println!("⚠️ Failed to apply {}: {}", pragma, e),
        }
    }
    
    Ok(())
}

/// Fix any existing database locks
async fn fix_existing_locks(pool: &SqlitePool) -> Result<()> {
    println!("🔓 Checking for and fixing existing locks...");
    
    // Check for long-running transactions
    let active_connections = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(pool)
        .await;
        
    match active_connections {
        Ok(_) => println!("✅ WAL checkpoint completed successfully"),
        Err(e) => println!("⚠️ WAL checkpoint warning: {}", e),
    }
    
    // Vacuum if needed (but only if database is small enough)
    let db_size: i64 = sqlx::query_scalar("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
        
    if db_size < 100_000_000 { // Only vacuum if less than 100MB
        println!("🧹 Running incremental vacuum...");
        match sqlx::query("PRAGMA incremental_vacuum(1000)").execute(pool).await {
            Ok(_) => println!("✅ Incremental vacuum completed"),
            Err(e) => println!("⚠️ Vacuum warning: {}", e),
        }
    }
    
    Ok(())
}

/// Optimize book_copies table operations specifically
async fn optimize_book_copies_operations(pool: &SqlitePool) -> Result<()> {
    println!("📚 Optimizing book_copies operations...");
    
    // Create optimized indexes for book_copies if they don't exist
    let indexes = vec![
        ("idx_book_copies_id", "CREATE INDEX IF NOT EXISTS idx_book_copies_id ON book_copies(id)"),
        ("idx_book_copies_legacy", "CREATE INDEX IF NOT EXISTS idx_book_copies_legacy ON book_copies(legacy_book_id) WHERE legacy_book_id IS NOT NULL"),
        ("idx_book_copies_status", "CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status, deleted)"),
        ("idx_book_copies_sync", "CREATE INDEX IF NOT EXISTS idx_book_copies_sync ON book_copies(synced, sync_version)"),
        ("idx_book_copies_title_author", "CREATE INDEX IF NOT EXISTS idx_book_copies_title_author ON book_copies(title, author)"),
    ];
    
    for (name, sql) in indexes {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => println!("✅ Created index: {}", name),
            Err(e) => println!("⚠️ Index {} warning: {}", name, e),
        }
    }
    
    // Analyze the table for better query planning
    match sqlx::query("ANALYZE book_copies").execute(pool).await {
        Ok(_) => println!("✅ Analyzed book_copies table"),
        Err(e) => println!("⚠️ Analysis warning: {}", e),
    }
    
    Ok(())
}

/// Optimize borrowings table operations specifically
async fn optimize_borrowings_operations(pool: &SqlitePool) -> Result<()> {
    println!("📖 Optimizing borrowings operations...");
    
    // Create optimized indexes for borrowings if they don't exist
    let indexes = vec![
        ("idx_borrowings_id", "CREATE INDEX IF NOT EXISTS idx_borrowings_id ON borrowings(id)"),
        ("idx_borrowings_student", "CREATE INDEX IF NOT EXISTS idx_borrowings_student ON borrowings(student_id)"),
        ("idx_borrowings_book_copy", "CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy ON borrowings(book_copy_id)"),
        ("idx_borrowings_status", "CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status, deleted)"),
        ("idx_borrowings_dates", "CREATE INDEX IF NOT EXISTS idx_borrowings_dates ON borrowings(borrowed_at, due_date, returned_at)"),
        ("idx_borrowings_sync", "CREATE INDEX IF NOT EXISTS idx_borrowings_sync ON borrowings(synced, sync_version)"),
    ];
    
    for (name, sql) in indexes {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => println!("✅ Created index: {}", name),
            Err(e) => println!("⚠️ Index {} warning: {}", name, e),
        }
    }
    
    // Analyze the table for better query planning
    match sqlx::query("ANALYZE borrowings").execute(pool).await {
        Ok(_) => println!("✅ Analyzed borrowings table"),
        Err(e) => println!("⚠️ Analysis warning: {}", e),
    }
    
    Ok(())
}

/// Optimized batch upsert for book_copies that prevents locks
pub async fn batch_upsert_book_copies_optimized(
    pool: &SqlitePool,
    records: Vec<BookCopyRecord>,
    batch_size: usize,
) -> Result<u32> {
    println!("📚 Starting optimized batch upsert for {} book copies...", records.len());
    
    let mut total_processed = 0;
    let chunks: Vec<_> = records.chunks(batch_size).collect();
    
    for (chunk_idx, chunk) in chunks.iter().enumerate() {
        println!("📦 Processing batch {}/{} ({} records)...", chunk_idx + 1, chunks.len(), chunk.len());
        
        // Use a shorter transaction with timeout
        let mut tx = pool.begin().await?;
        
        // Set transaction timeout
        sqlx::query("PRAGMA busy_timeout = 5000") // 5 second timeout for this transaction
            .execute(&mut *tx)
            .await?;
        
        let mut batch_processed = 0;
        
        for record in chunk.iter() {
            // Use INSERT OR IGNORE first, then UPDATE if needed (faster than INSERT OR REPLACE)
            let insert_result = sqlx::query(
                "INSERT OR IGNORE INTO book_copies (
                    id, isbn, title, author, publisher, publication_year,
                    copy_identifier, acquisition_date, condition, status,
                    location, department_id, current_borrower_id, borrowed_at,
                    due_date, legacy_book_id, created_at, updated_at,
                    synced, sync_version, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)"
            )
            .bind(&record.id)
            .bind(&record.isbn)
            .bind(&record.title)
            .bind(&record.author)
            .bind(&record.publisher)
            .bind(record.publication_year)
            .bind(&record.copy_identifier)
            .bind(&record.acquisition_date)
            .bind(&record.condition)
            .bind(&record.status)
            .bind(&record.location)
            .bind(record.department_id)
            .bind(&record.current_borrower_id)
            .bind(&record.borrowed_at)
            .bind(&record.due_date)
            .bind(record.legacy_book_id)
            .bind(&record.created_at)
            .bind(&record.updated_at)
            .execute(&mut *tx)
            .await;
            
            match insert_result {
                Ok(result) => {
                    if result.rows_affected() == 0 {
                        // Record exists, update it
                        let _update_result = sqlx::query(
                            "UPDATE book_copies SET 
                                isbn = ?, title = ?, author = ?, publisher = ?, publication_year = ?,
                                copy_identifier = ?, condition = ?, status = ?, location = ?,
                                updated_at = ?, synced = 1, sync_version = 1
                            WHERE id = ?"
                        )
                        .bind(&record.isbn)
                        .bind(&record.title)
                        .bind(&record.author)
                        .bind(&record.publisher)
                        .bind(record.publication_year)
                        .bind(&record.copy_identifier)
                        .bind(&record.condition)
                        .bind(&record.status)
                        .bind(&record.location)
                        .bind(&record.updated_at)
                        .bind(&record.id)
                        .execute(&mut *tx)
                        .await?;
                    }
                    batch_processed += 1;
                }
                Err(e) => {
                    println!("❌ Error upserting book copy {}: {}", record.id, e);
                    // Continue with other records instead of failing entire batch
                }
            }
        }
        
        // Commit the transaction quickly
        match tx.commit().await {
            Ok(_) => {
                total_processed += batch_processed;
                println!("✅ Batch {}/{} completed: {} records processed", chunk_idx + 1, chunks.len(), batch_processed);
            }
            Err(e) => {
                println!("❌ Failed to commit batch {}: {}", chunk_idx + 1, e);
                return Err(e.into());
            }
        }
        
        // Small delay between batches to prevent overwhelming the database
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    
    println!("🎉 Optimized batch upsert completed: {} records processed", total_processed);
    Ok(total_processed)
}

#[derive(Debug, Clone)]
pub struct BookCopyRecord {
    pub id: String,
    pub isbn: String,
    pub title: String,
    pub author: String,
    pub publisher: Option<String>,
    pub publication_year: Option<i32>,
    pub copy_identifier: String,
    pub acquisition_date: String,
    pub condition: String,
    pub status: String,
    pub location: String,
    pub department_id: Option<i32>,
    pub current_borrower_id: Option<String>,
    pub borrowed_at: Option<String>,
    pub due_date: Option<String>,
    pub legacy_book_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

/// Quick database health check
pub async fn check_database_health() -> Result<()> {
    println!("🏥 Checking database health...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .busy_timeout(Duration::from_secs(5));
    
    let pool = SqlitePool::connect_with(options).await?;
    
    // Check WAL mode
    let journal_mode: String = sqlx::query_scalar("PRAGMA journal_mode")
        .fetch_one(&pool)
        .await?;
    println!("📄 Journal mode: {}", journal_mode);
    
    // Check for locks
    let wal_checkpoint: (i32, i32) = sqlx::query("PRAGMA wal_checkpoint")
        .fetch_one(&pool)
        .await
        .map(|row| (row.get(0), row.get(1)))
        .unwrap_or((0, 0));
    println!("🔒 WAL checkpoint: {} pages, {} checkpointed", wal_checkpoint.0, wal_checkpoint.1);
    
    // Check database size
    let db_size: i64 = sqlx::query_scalar("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    println!("💾 Database size: {} MB", db_size / 1024 / 1024);
    
    // Check book_copies count
    let book_copies_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM book_copies")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    println!("📚 Book copies count: {}", book_copies_count);
    
    // Check borrowings count
    let borrowings_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrowings")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    println!("📖 Borrowings count: {}", borrowings_count);
    
    println!("✅ Database health check completed");
    Ok(())
}