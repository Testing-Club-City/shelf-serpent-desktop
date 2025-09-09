use anyhow::Result;
use reqwest;
use serde_json::Value;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::ConnectOptions;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

/// Optimized book copies sync that prevents database locking
pub async fn sync_book_copies_optimized() -> Result<u32> {
    println!("🚀 Starting OPTIMIZED book copies sync (lock-free)...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Create optimized connection pool
    let pool = create_optimized_pool(&db_path).await?;
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;
        
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Step 1: Prepare database with optimizations
    prepare_database_for_sync(&pool).await?;
    
    // Step 2: Build books lookup cache
    let books_map = build_books_cache(&pool, &client, anon_key).await?;
    println!("✅ Books cache ready: {} books loaded", books_map.len());
    
    // Step 3: Sync book copies in small, fast batches
    let total_processed = sync_book_copies_in_batches(&pool, &client, anon_key, &books_map).await?;
    
    // Step 4: Finalize and optimize
    finalize_sync(&pool).await?;
    
    println!("🎉 Optimized book copies sync completed: {} records processed", total_processed);
    Ok(total_processed)
}

/// Create an optimized SQLite connection pool
async fn create_optimized_pool(db_path: &PathBuf) -> Result<SqlitePool> {
    let mut options = SqliteConnectOptions::new()
        .filename(db_path)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(10))  // Shorter timeout for faster failure
        .pragma("cache_size", "-32000")         // 32MB cache (smaller for faster commits)
        .pragma("temp_store", "memory")
        .pragma("mmap_size", "134217728")       // 128MB memory map
        .pragma("wal_autocheckpoint", "100")    // More frequent checkpoints
        .create_if_missing(true);
    
    options.log_statements(log::LevelFilter::Off);
    
    let pool = SqlitePool::connect_with(options).await?;
    println!("✅ Optimized database pool created");
    Ok(pool)
}

/// Prepare database for high-performance sync
async fn prepare_database_for_sync(pool: &SqlitePool) -> Result<()> {
    println!("⚙️ Preparing database for sync...");
    
    // Checkpoint WAL to start fresh
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(pool)
        .await?;
    
    // Create optimized indexes if they don't exist
    let indexes = [
        "CREATE INDEX IF NOT EXISTS idx_book_copies_id_fast ON book_copies(id) WHERE deleted = 0",
        "CREATE INDEX IF NOT EXISTS idx_book_copies_legacy_fast ON book_copies(legacy_book_id) WHERE legacy_book_id IS NOT NULL AND deleted = 0",
    ];
    
    for index_sql in &indexes {
        sqlx::query(index_sql).execute(pool).await?;
    }
    
    println!("✅ Database prepared for sync");
    Ok(())
}

/// Build books lookup cache efficiently
async fn build_books_cache(
    pool: &SqlitePool,
    client: &reqwest::Client,
    anon_key: &str,
) -> Result<HashMap<String, BookDetails>> {
    let mut books_map = HashMap::new();
    
    // Load from local database first (faster)
    let local_books = sqlx::query!(
        "SELECT id, isbn, title, author, publisher, publication_year FROM books WHERE deleted = 0 LIMIT 10000"
    )
    .fetch_all(pool)
    .await?;
    
    for book in local_books {
        books_map.insert(book.id, BookDetails {
            isbn: book.isbn.unwrap_or_default(),
            title: book.title,
            author: book.author,
            publisher: book.publisher.unwrap_or_default(),
            publication_year: book.publication_year.unwrap_or(2024),
        });
    }
    
    println!("📖 Loaded {} books from local database", books_map.len());
    Ok(books_map)
}

/// Sync book copies in optimized batches
async fn sync_book_copies_in_batches(
    pool: &SqlitePool,
    client: &reqwest::Client,
    anon_key: &str,
    books_map: &HashMap<String, BookDetails>,
) -> Result<u32> {
    let batch_size = 100; // Smaller batches for faster commits
    let mut offset = 0;
    let mut total_processed = 0;
    
    loop {
        println!("📦 Fetching batch starting at offset {}...", offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .timeout(Duration::from_secs(15))  // Shorter timeout
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch book_copies: {}", response.status());
            break;
        }
        
        let json: Value = response.json().await?;
        let records = json.as_array().unwrap_or(&vec![]);
        
        if records.is_empty() {
            println!("✅ No more book copies to fetch");
            break;
        }
        
        println!("📚 Processing {} book copies in this batch...", records.len());
        
        // Process batch with optimized transaction
        let batch_processed = process_batch_optimized(pool, records, books_map).await?;
        total_processed += batch_processed;
        
        println!("✅ Batch completed: {} processed (total: {})", batch_processed, total_processed);
        
        offset += batch_size;
        
        // Small delay to prevent overwhelming the database
        tokio::time::sleep(Duration::from_millis(5)).await;
    }
    
    Ok(total_processed)
}

/// Process a batch with optimized database operations
async fn process_batch_optimized(
    pool: &SqlitePool,
    records: &[Value],
    books_map: &HashMap<String, BookDetails>,
) -> Result<u32> {
    // Use a short-lived transaction
    let mut tx = pool.begin().await?;
    
    // Set transaction-specific timeout
    sqlx::query("PRAGMA busy_timeout = 3000")
        .execute(&mut *tx)
        .await?;
    
    let mut processed = 0;
    
    for record in records {
        if let Some(_) = process_single_record_fast(&mut tx, record, books_map).await? {
            processed += 1;
        }
    }
    
    // Quick commit
    tx.commit().await?;
    Ok(processed)
}

/// Process a single record with minimal database operations
async fn process_single_record_fast(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    record: &Value,
    books_map: &HashMap<String, BookDetails>,
) -> Result<Option<u32>> {
    let id = record["id"].as_str().unwrap_or_default();
    let book_id = record["book_id"].as_str().unwrap_or_default();
    let tracking_code = record["tracking_code"].as_str().unwrap_or_default();
    let condition = record["condition"].as_str().unwrap_or("good");
    let status = record["status"].as_str().unwrap_or("available");
    let legacy_book_id = record["legacy_book_id"].as_i64();
    let created_at = record["created_at"].as_str().unwrap_or_default();
    let updated_at = record["updated_at"].as_str().unwrap_or_default();
    
    // Get book details
    let book_details = match books_map.get(book_id) {
        Some(details) => details,
        None => {
            // Skip records without book details to avoid errors
            return Ok(None);
        }
    };
    
    // Map status and condition
    let local_status = match status {
        "available" => "available",
        "borrowed" => "checked_out",
        "maintenance" => "repair",
        "lost" | "stolen" => "lost",
        _ => "available",
    };
    
    let local_condition = match condition {
        "good" | "fair" | "poor" | "damaged" => condition,
        "lost" => "poor",
        _ => "good",
    };
    
    // Use INSERT OR IGNORE + UPDATE pattern (faster than INSERT OR REPLACE)
    let insert_result = sqlx::query(
        "INSERT OR IGNORE INTO book_copies (
            id, isbn, title, author, publisher, publication_year,
            copy_identifier, acquisition_date, condition, status,
            location, department_id, legacy_book_id, created_at, updated_at,
            synced, sync_version, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), ?, ?, 'Main Library', 1, ?, ?, ?, 1, 1, 0)"
    )
    .bind(id)
    .bind(&book_details.isbn)
    .bind(&book_details.title)
    .bind(&book_details.author)
    .bind(&book_details.publisher)
    .bind(book_details.publication_year)
    .bind(tracking_code)
    .bind(local_condition)
    .bind(local_status)
    .bind(legacy_book_id)
    .bind(created_at)
    .bind(updated_at)
    .execute(&mut **tx)
    .await;
    
    match insert_result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                // Record exists, update it quickly
                sqlx::query(
                    "UPDATE book_copies SET 
                        condition = ?, status = ?, updated_at = ?, synced = 1
                    WHERE id = ?"
                )
                .bind(local_condition)
                .bind(local_status)
                .bind(updated_at)
                .bind(id)
                .execute(&mut **tx)
                .await?;
            }
            Ok(Some(1))
        }
        Err(e) => {
            println!("❌ Error upserting book copy {}: error returned from database: {}", id, e);
            Ok(None)
        }
    }
}

/// Finalize sync with database optimizations
async fn finalize_sync(pool: &SqlitePool) -> Result<()> {
    println!("🏁 Finalizing sync...");
    
    // Checkpoint WAL to free up space
    sqlx::query("PRAGMA wal_checkpoint(PASSIVE)")
        .execute(pool)
        .await?;
    
    // Update statistics
    sqlx::query("ANALYZE book_copies")
        .execute(pool)
        .await?;
    
    println!("✅ Sync finalized");
    Ok(())
}

#[derive(Debug, Clone)]
struct BookDetails {
    isbn: String,
    title: String,
    author: String,
    publisher: String,
    publication_year: i32,
}

/// Quick health check for database locks
pub async fn check_database_locks() -> Result<()> {
    println!("🔍 Checking for database locks...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .busy_timeout(Duration::from_secs(1));
    
    let pool = SqlitePool::connect_with(options).await?;
    
    // Quick WAL checkpoint test
    let start = std::time::Instant::now();
    let checkpoint_result = sqlx::query("PRAGMA wal_checkpoint")
        .execute(&pool)
        .await;
    let duration = start.elapsed();
    
    match checkpoint_result {
        Ok(_) => println!("✅ Database accessible ({}ms)", duration.as_millis()),
        Err(e) => println!("❌ Database lock detected: {}", e),
    }
    
    Ok(())
}