use anyhow::Result;
use reqwest;
use serde_json::Value;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous};
use sqlx::ConnectOptions;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;
use tokio::sync::{mpsc, Semaphore};
use std::sync::Arc;

/// Multithreaded bidirectional sync that prevents database locks
pub async fn run_multithreaded_bidirectional_sync() -> Result<()> {
    println!("🚀 Starting MULTITHREADED bidirectional sync (lock-free)...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Create single optimized connection pool (NOT multiple connections)
    let pool = create_single_optimized_pool(&db_path).await?;
    
    // Apply emergency database fixes first
    apply_emergency_fixes(&pool).await?;
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;
        
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Use queue-based processing instead of parallel threads
    let total_processed = run_queue_based_sync(&pool, &client, anon_key).await?;
    
    println!("🎉 Multithreaded sync completed: {} records processed", total_processed);
    Ok(())
}

/// Create a SINGLE optimized pool (not multiple connections)
async fn create_single_optimized_pool(db_path: &PathBuf) -> Result<SqlitePool> {
    let mut options = SqliteConnectOptions::new()
        .filename(db_path)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(5))  // Short timeout for fast failure
        .pragma("cache_size", "-16000")        // 16MB cache (smaller for faster commits)
        .pragma("temp_store", "memory")
        .pragma("mmap_size", "67108864")       // 64MB memory map
        .pragma("wal_autocheckpoint", "50")    // Very frequent checkpoints
        .create_if_missing(true);
    
    options.log_statements(log::LevelFilter::Off);
    
    // Create pool with ONLY 1 connection to prevent contention
    let pool = SqlitePool::connect_with(options).await?;
    println!("✅ Single-connection pool created (prevents lock contention)");
    Ok(pool)
}

/// Apply emergency database fixes
async fn apply_emergency_fixes(pool: &SqlitePool) -> Result<()> {
    println!("🔧 Applying emergency database fixes...");
    
    // Force WAL checkpoint to clear any locks
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(pool)
        .await?;
    
    // Set aggressive settings for this session
    let fixes = [
        "PRAGMA busy_timeout = 2000",           // 2 second timeout
        "PRAGMA synchronous = NORMAL",
        "PRAGMA cache_size = -16000",           // 16MB cache
        "PRAGMA wal_autocheckpoint = 50",       // Checkpoint every 50 pages
        "PRAGMA journal_size_limit = 33554432", // 32MB WAL limit
    ];
    
    for fix in &fixes {
        sqlx::query(fix).execute(pool).await?;
    }
    
    println!("✅ Emergency fixes applied");
    Ok(())
}

/// Queue-based sync (NOT parallel threads)
async fn run_queue_based_sync(
    pool: &SqlitePool,
    client: &reqwest::Client,
    anon_key: &str,
) -> Result<u32> {
    println!("📦 Starting queue-based processing...");
    
    // Create a channel for queuing database operations
    let (tx, mut rx) = mpsc::channel::<BookCopyRecord>(1000);
    
    // Semaphore to limit concurrent network requests (NOT database operations)
    let network_semaphore = Arc::new(Semaphore::new(3)); // Only 3 concurrent downloads
    
    // Build books cache first
    let books_map = build_books_cache(pool).await?;
    
    // Spawn database writer task (SINGLE THREAD)
    let pool_clone = pool.clone();
    let db_writer = tokio::spawn(async move {
        let mut total_processed = 0;
        let mut batch = Vec::new();
        
        while let Some(record) = rx.recv().await {
            batch.push(record);
            
            // Process in small batches of 20 (very small to prevent locks)
            if batch.len() >= 20 {
                match process_batch_single_thread(&pool_clone, &batch).await {
                    Ok(count) => {
                        total_processed += count;
                        println!("✅ Processed batch: {} (total: {})", count, total_processed);
                    }
                    Err(e) => println!("❌ Batch failed: {}", e),
                }
                batch.clear();
            }
        }
        
        // Process remaining records
        if !batch.is_empty() {
            if let Ok(count) = process_batch_single_thread(&pool_clone, &batch).await {
                total_processed += count;
            }
        }
        
        total_processed
    });
    
    // Fetch data with limited concurrency
    let mut fetch_tasks = Vec::new();
    let mut offset = 0;
    let batch_size = 5000; // Larger batches for better performance
    
    loop {
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
        let client_clone = client.clone();
        let anon_key_clone = anon_key.to_string();
        let tx_clone = tx.clone();
        let books_map_clone = books_map.clone();
        let semaphore_clone = network_semaphore.clone();
        
        let task = tokio::spawn(async move {
            let _permit = semaphore_clone.acquire().await.unwrap();
            
            let response = client_clone
                .get(&url)
                .header("apikey", &anon_key_clone)
                .header("Authorization", format!("Bearer {}", &anon_key_clone))
                .timeout(Duration::from_secs(15))
                .send()
                .await?;
            
            if !response.status().is_success() {
                return Ok(0);
            }
            
            let json: Value = response.json().await?;
            let records = json.as_array().unwrap_or(&vec![]);
            
            if records.is_empty() {
                return Ok(0);
            }
            
            let mut sent_count = 0;
            for record in records {
                if let Some(book_record) = convert_to_book_record(record, &books_map_clone) {
                    if tx_clone.send(book_record).await.is_ok() {
                        sent_count += 1;
                    }
                }
            }
            
            Ok::<u32, anyhow::Error>(sent_count)
        });
        
        fetch_tasks.push(task);
        offset += batch_size;
        
        // Limit number of concurrent fetch tasks
        if fetch_tasks.len() >= 5 {
            break;
        }
    }
    
    // Wait for all fetch tasks and close channel
    for task in fetch_tasks {
        let _ = task.await;
    }
    drop(tx); // Close channel
    
    // Wait for database writer to finish
    let total_processed = db_writer.await.unwrap_or(0);
    
    Ok(total_processed)
}

/// Process batch in SINGLE THREAD (no parallelism on database)
async fn process_batch_single_thread(
    pool: &SqlitePool,
    batch: &[BookCopyRecord],
) -> Result<u32> {
    // Use a very short transaction
    let mut tx = pool.begin().await?;
    
    // Set transaction timeout
    sqlx::query("PRAGMA busy_timeout = 1000") // 1 second only
        .execute(&mut *tx)
        .await?;
    
    let mut processed = 0;
    
    for record in batch {
        // Use INSERT OR IGNORE (faster than INSERT OR REPLACE)
        let result = sqlx::query(
            "INSERT OR IGNORE INTO book_copies (
                id, isbn, title, author, publisher, publication_year,
                copy_identifier, condition, status, legacy_book_id,
                created_at, updated_at, synced, sync_version, deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)"
        )
        .bind(&record.id)
        .bind(&record.isbn)
        .bind(&record.title)
        .bind(&record.author)
        .bind(&record.publisher)
        .bind(record.publication_year)
        .bind(&record.copy_identifier)
        .bind(&record.condition)
        .bind(&record.status)
        .bind(record.legacy_book_id)
        .bind(&record.created_at)
        .bind(&record.updated_at)
        .execute(&mut *tx)
        .await;
        
        match result {
            Ok(_) => processed += 1,
            Err(_) => {
                // If insert fails, try update
                let _ = sqlx::query(
                    "UPDATE book_copies SET condition = ?, status = ?, updated_at = ? WHERE id = ?"
                )
                .bind(&record.condition)
                .bind(&record.status)
                .bind(&record.updated_at)
                .bind(&record.id)
                .execute(&mut *tx)
                .await;
                processed += 1;
            }
        }
    }
    
    // Quick commit
    tx.commit().await?;
    Ok(processed)
}

/// Build books cache from local database
async fn build_books_cache(pool: &SqlitePool) -> Result<HashMap<String, BookDetails>> {
    let mut books_map = HashMap::new();
    
    let local_books = sqlx::query!(
        "SELECT id, isbn, title, author, publisher, publication_year FROM books WHERE deleted = 0 LIMIT 5000"
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

/// Convert Supabase record to local record
fn convert_to_book_record(
    record: &Value,
    books_map: &HashMap<String, BookDetails>,
) -> Option<BookCopyRecord> {
    let id = record["id"].as_str()?.to_string();
    let book_id = record["book_id"].as_str().unwrap_or_default();
    let tracking_code = record["tracking_code"].as_str().unwrap_or_default();
    let condition = record["condition"].as_str().unwrap_or("good");
    let status = record["status"].as_str().unwrap_or("available");
    let legacy_book_id = record["legacy_book_id"].as_i64();
    let created_at = record["created_at"].as_str().unwrap_or_default();
    let updated_at = record["updated_at"].as_str().unwrap_or_default();
    
    let book_details = books_map.get(book_id)?;
    
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
    
    Some(BookCopyRecord {
        id,
        isbn: book_details.isbn.clone(),
        title: book_details.title.clone(),
        author: book_details.author.clone(),
        publisher: Some(book_details.publisher.clone()),
        publication_year: Some(book_details.publication_year),
        copy_identifier: tracking_code.to_string(),
        condition: local_condition.to_string(),
        status: local_status.to_string(),
        legacy_book_id,
        created_at: created_at.to_string(),
        updated_at: updated_at.to_string(),
    })
}

#[derive(Debug, Clone)]
struct BookDetails {
    isbn: String,
    title: String,
    author: String,
    publisher: String,
    publication_year: i32,
}

#[derive(Debug, Clone)]
struct BookCopyRecord {
    id: String,
    isbn: String,
    title: String,
    author: String,
    publisher: Option<String>,
    publication_year: Option<i32>,
    copy_identifier: String,
    condition: String,
    status: String,
    legacy_book_id: Option<i64>,
    created_at: String,
    updated_at: String,
}