use anyhow::Result;
use reqwest;
use serde_json::Value;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqliteJournalMode};
use std::path::PathBuf;
use std::time::Duration;

#[tauri::command]
pub async fn sync_remaining_book_copies() -> Result<String, String> {
    match sync_remaining_book_copies_internal().await {
        Ok(count) => Ok(format!("Successfully synced {} remaining book copies", count)),
        Err(e) => Err(format!("Failed to sync remaining book copies: {}", e)),
    }
}

async fn sync_remaining_book_copies_internal() -> Result<u32> {
    println!("🔄 Starting sync for remaining book copies...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    let mut options = SqliteConnectOptions::new()
        .filename(&db_path)
        .journal_mode(SqliteJournalMode::Wal)
        .create_if_missing(true);
    options.log_statements(log::LevelFilter::Off);
    
    let pool = SqlitePool::connect_with(options).await?;
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))  // Longer timeout
        .build()?;
        
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get current local count
    let local_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM book_copies")
        .fetch_one(&pool)
        .await?;
    
    println!("📊 Current local book copies: {}", local_count);
    
    // Get total count from Supabase
    let total_count = get_total_supabase_count(&client, anon_key).await?;
    println!("📊 Total Supabase book copies: {}", total_count);
    
    let missing_count = total_count - local_count as u32;
    println!("⚠️  Missing {} book copies", missing_count);
    
    if missing_count == 0 {
        println!("✅ All book copies are already synced!");
        return Ok(0);
    }
    
    // Sync remaining records with robust pagination
    let synced = sync_with_robust_pagination(&pool, &client, anon_key, local_count as u32).await?;
    
    println!("🎉 Successfully synced {} additional book copies", synced);
    Ok(synced)
}

async fn get_total_supabase_count(client: &reqwest::Client, anon_key: &str) -> Result<u32> {
    let response = client
        .get("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=id")
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .send()
        .await?;
    
    let content_range = response.headers()
        .get("content-range")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("0");
    
    if let Some(total_str) = content_range.split('/').last() {
        Ok(total_str.parse().unwrap_or(0))
    } else {
        Ok(0)
    }
}

async fn sync_with_robust_pagination(
    pool: &SqlitePool,
    client: &reqwest::Client,
    anon_key: &str,
    start_offset: u32,
) -> Result<u32> {
    let batch_size = 50; // Smaller batches for reliability
    let mut offset = start_offset;
    let mut total_synced = 0;
    let mut consecutive_empty_batches = 0;
    
    loop {
        println!("📦 Fetching batch at offset {}...", offset);
        
        match fetch_batch(client, anon_key, batch_size, offset).await {
            Ok(records) => {
                if records.is_empty() {
                    consecutive_empty_batches += 1;
                    if consecutive_empty_batches >= 3 {
                        println!("✅ No more records found after 3 empty batches");
                        break;
                    }
                    offset += batch_size;
                    continue;
                }
                
                consecutive_empty_batches = 0;
                println!("📚 Processing {} records...", records.len());
                
                match process_batch_safe(pool, &records).await {
                    Ok(processed) => {
                        total_synced += processed;
                        println!("✅ Processed {} records (total: {})", processed, total_synced);
                    }
                    Err(e) => {
                        println!("⚠️  Error processing batch: {}, continuing...", e);
                    }
                }
                
                offset += batch_size;
                
                // Small delay to be respectful to the API
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            Err(e) => {
                println!("⚠️  Error fetching batch: {}, retrying...", e);
                tokio::time::sleep(Duration::from_secs(2)).await;
                // Don't increment offset on error, retry the same batch
            }
        }
        
        // Safety check to prevent infinite loops
        if offset > 200000 {
            println!("🛑 Safety limit reached, stopping sync");
            break;
        }
    }
    
    Ok(total_synced)
}

async fn fetch_batch(
    client: &reqwest::Client,
    anon_key: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<Value>> {
    let url = format!(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit={}&offset={}",
        limit, offset
    );
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .timeout(Duration::from_secs(30))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("HTTP {}: {}", response.status(), response.text().await?));
    }
    
    let json: Value = response.json().await?;
    Ok(json.as_array().unwrap_or(&vec![]).clone())
}

async fn process_batch_safe(pool: &SqlitePool, records: &[Value]) -> Result<u32> {
    let mut processed = 0;
    
    for record in records {
        match process_single_record(pool, record).await {
            Ok(_) => processed += 1,
            Err(e) => {
                println!("⚠️  Error processing record {}: {}", 
                    record.get("id").and_then(|v| v.as_str()).unwrap_or("unknown"), e);
            }
        }
    }
    
    Ok(processed)
}

async fn process_single_record(pool: &SqlitePool, record: &Value) -> Result<()> {
    let id = record["id"].as_str().unwrap_or_default();
    let book_id = record["book_id"].as_str().unwrap_or_default();
    let tracking_code = record["tracking_code"].as_str().unwrap_or_default();
    let condition = record["condition"].as_str().unwrap_or("good");
    let status = record["status"].as_str().unwrap_or("available");
    let legacy_book_id = record["legacy_book_id"].as_i64();
    let created_at = record["created_at"].as_str().unwrap_or_default();
    let updated_at = record["updated_at"].as_str().unwrap_or_default();
    
    // Get book details from local database
    let book_details: Option<(String, String, String, String, Option<i32>)> = sqlx::query_as(
        "SELECT isbn, title, author, publisher, publication_year FROM books WHERE id = ?"
    )
    .bind(book_id)
    .fetch_optional(pool)
    .await?;
    
    let (isbn, title, author, publisher, publication_year) = match book_details {
        Some(details) => details,
        None => {
            // Use defaults if book not found
            ("".to_string(), "Unknown Title".to_string(), "Unknown Author".to_string(), 
             "Unknown Publisher".to_string(), None)
        }
    };
    
    sqlx::query(
        "INSERT OR REPLACE INTO book_copies (
            id, isbn, title, author, publisher, publication_year,
            copy_identifier, acquisition_date, condition, status,
            location, department_id, legacy_book_id, created_at, updated_at,
            synced, sync_version, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), ?, ?, 'Main Library', 1, ?, ?, ?, 1, 1, 0)"
    )
    .bind(id)
    .bind(isbn)
    .bind(title)
    .bind(author)
    .bind(publisher)
    .bind(publication_year)
    .bind(tracking_code)
    .bind(condition)
    .bind(status)
    .bind(legacy_book_id)
    .bind(created_at)
    .bind(updated_at)
    .execute(pool)
    .await?;
    
    Ok(())
}
