use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use serde_json::Value;
use std::path::PathBuf;
use tracing::{info, warn};

// Incremental sync methods for fast mode switching
pub async fn sync_borrowings_incremental(limit: u32) -> Result<u32> {
    info!("🔄 Starting incremental borrowings sync (limit: {})", limit);
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Get latest timestamp from local database
    let last_sync_timestamp = get_last_sync_timestamp(&pool, "borrowings").await?;
    
    // Fetch only recent records from Supabase
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let mut url = format!("{}/rest/v1/borrowings?select=*&limit={}", supabase_url, limit);
    
    if let Some(timestamp) = last_sync_timestamp {
        url.push_str(&format!("&updated_at=gt.{}", timestamp));
    }
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Supabase request failed: {}", response.status()));
    }
    
    let borrowings: Vec<Value> = response.json().await?;
    
    if borrowings.is_empty() {
        info!("✅ No new borrowings to sync");
        return Ok(0);
    }
    
    // Insert/update borrowings in batches
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for borrowing in borrowings {
        let query = r#"
            INSERT OR REPLACE INTO borrowings (
                id, student_id, book_id, book_copy_id, borrowed_date, due_date,
                returned_date, status, fine_amount, notes, created_at, updated_at,
                synced, sync_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        "#;
        
        let result = sqlx::query(query)
            .bind(borrowing["id"].as_str().unwrap_or_default())
            .bind(borrowing["student_id"].as_str())
            .bind(borrowing["book_id"].as_str())
            .bind(borrowing["book_copy_id"].as_str())
            .bind(borrowing["borrowed_date"].as_str())
            .bind(borrowing["due_date"].as_str())
            .bind(borrowing["returned_date"].as_str())
            .bind(borrowing["status"].as_str().unwrap_or("active"))
            .bind(borrowing["fine_amount"].as_f64())
            .bind(borrowing["notes"].as_str())
            .bind(borrowing["created_at"].as_str())
            .bind(borrowing["updated_at"].as_str())
            .execute(&mut *tx)
            .await;
            
        if result.is_ok() {
            inserted += 1;
        }
    }
    
    tx.commit().await?;
    
    // Update last sync timestamp
    update_last_sync_timestamp(&pool, "borrowings").await?;
    
    info!("✅ Incremental borrowings sync completed: {} records", inserted);
    Ok(inserted)
}

pub async fn sync_students_incremental(limit: u32) -> Result<u32> {
    info!("🔄 Starting incremental students sync (limit: {})", limit);
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let last_sync_timestamp = get_last_sync_timestamp(&pool, "students").await?;
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let mut url = format!("{}/rest/v1/students?select=*&limit={}", supabase_url, limit);
    
    if let Some(timestamp) = last_sync_timestamp {
        url.push_str(&format!("&updated_at=gt.{}", timestamp));
    }
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Supabase request failed: {}", response.status()));
    }
    
    let students: Vec<Value> = response.json().await?;
    
    if students.is_empty() {
        info!("✅ No new students to sync");
        return Ok(0);
    }
    
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for student in students {
        let query = r#"
            INSERT OR REPLACE INTO students (
                id, admission_number, first_name, last_name, email, phone,
                class_grade, address, date_of_birth, enrollment_date, status,
                created_at, updated_at, synced, sync_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        "#;
        
        let result = sqlx::query(query)
            .bind(student["id"].as_str().unwrap_or_default())
            .bind(student["admission_number"].as_str())
            .bind(student["first_name"].as_str().unwrap_or("Unknown"))
            .bind(student["last_name"].as_str().unwrap_or("Unknown"))
            .bind(student["email"].as_str())
            .bind(student["phone"].as_str())
            .bind(student["class_grade"].as_str())
            .bind(student["address"].as_str())
            .bind(student["date_of_birth"].as_str())
            .bind(student["enrollment_date"].as_str())
            .bind(student["status"].as_str().unwrap_or("active"))
            .bind(student["created_at"].as_str())
            .bind(student["updated_at"].as_str())
            .execute(&mut *tx)
            .await;
            
        if result.is_ok() {
            inserted += 1;
        }
    }
    
    tx.commit().await?;
    update_last_sync_timestamp(&pool, "students").await?;
    
    info!("✅ Incremental students sync completed: {} records", inserted);
    Ok(inserted)
}

pub async fn sync_books_incremental(limit: u32) -> Result<u32> {
    info!("🔄 Starting incremental books sync (limit: {})", limit);
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let last_sync_timestamp = get_last_sync_timestamp(&pool, "books").await?;
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let mut url = format!("{}/rest/v1/books?select=*&limit={}", supabase_url, limit);
    
    if let Some(timestamp) = last_sync_timestamp {
        url.push_str(&format!("&updated_at=gt.{}", timestamp));
    }
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Supabase request failed: {}", response.status()));
    }
    
    let books: Vec<Value> = response.json().await?;
    
    if books.is_empty() {
        info!("✅ No new books to sync");
        return Ok(0);
    }
    
    let mut inserted = 0;
    let mut tx = pool.begin().await?;
    
    for book in books {
        let query = r#"
            INSERT OR REPLACE INTO books (
                id, title, author, isbn, genre, publisher, publication_year,
                total_copies, available_copies, shelf_location, description,
                status, category_id, created_at, updated_at, synced, sync_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        "#;
        
        let result = sqlx::query(query)
            .bind(book["id"].as_str().unwrap_or_default())
            .bind(book["title"].as_str().unwrap_or("Unknown Title"))
            .bind(book["author"].as_str().unwrap_or("Unknown Author"))
            .bind(book["isbn"].as_str())
            .bind(book["genre"].as_str())
            .bind(book["publisher"].as_str())
            .bind(book["publication_year"].as_i64())
            .bind(book["total_copies"].as_i64().unwrap_or(1))
            .bind(book["available_copies"].as_i64().unwrap_or(1))
            .bind(book["shelf_location"].as_str())
            .bind(book["description"].as_str())
            .bind(book["status"].as_str().unwrap_or("available"))
            .bind(book["category_id"].as_str())
            .bind(book["created_at"].as_str())
            .bind(book["updated_at"].as_str())
            .execute(&mut *tx)
            .await;
            
        if result.is_ok() {
            inserted += 1;
        }
    }
    
    tx.commit().await?;
    update_last_sync_timestamp(&pool, "books").await?;
    
    info!("✅ Incremental books sync completed: {} records", inserted);
    Ok(inserted)
}

// Helper function to get last sync timestamp for a table
async fn get_last_sync_timestamp(pool: &SqlitePool, table_name: &str) -> Result<Option<String>> {
    let query = "SELECT value FROM sync_metadata WHERE key = ?";
    let key = format!("last_sync_{}", table_name);
    
    match sqlx::query_scalar::<_, String>(query)
        .bind(&key)
        .fetch_optional(pool)
        .await
    {
        Ok(timestamp) => Ok(timestamp),
        Err(_) => {
            // Create sync_metadata table if it doesn't exist
            let create_table = r#"
                CREATE TABLE IF NOT EXISTS sync_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            "#;
            
            sqlx::query(create_table).execute(pool).await?;
            Ok(None)
        }
    }
}

// Helper function to update last sync timestamp for a table
async fn update_last_sync_timestamp(pool: &SqlitePool, table_name: &str) -> Result<()> {
    let query = r#"
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES (?, datetime('now'), datetime('now'))
    "#;
    
    let key = format!("last_sync_{}", table_name);
    
    sqlx::query(query)
        .bind(&key)
        .execute(pool)
        .await?;
    
    Ok(())
}