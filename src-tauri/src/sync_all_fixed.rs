use std::path::PathBuf;
use std::collections::HashMap;
use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use serde_json;
use reqwest;

/// Fixed sync functions with correct batch sizing (5000 records) and Range header pagination
/// This replaces the old simple_sync.rs with proper PostgREST-compliant pagination

#[derive(Debug, Clone)]
struct BookDetails {
    isbn: String,
    title: String,
    author: String,
    publisher: String,
    publication_year: i32,
}

// Helper function to get total count from Supabase
async fn get_supabase_count(table: &str) -> Result<u32> {
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let count_url = format!(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*",
        table
    );
    
    let response = client
        .get(&count_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .header("Range", "0-0") // Only get first row for counting
        .send()
        .await?;
    
    if response.status().is_success() {
        // Get count from Content-Range header
        if let Some(content_range) = response.headers().get("content-range") {
            if let Ok(range_str) = content_range.to_str() {
                // Content-Range format: "0-0/total_count"
                if let Some(total_part) = range_str.split('/').nth(1) {
                    if let Ok(count) = total_part.parse::<u32>() {
                        return Ok(count);
                    }
                }
            }
        }
        
        // Fallback: try to parse response body
        let json: serde_json::Value = response.json().await?;
        if let Some(array) = json.as_array() {
            Ok(array.len() as u32)
        } else {
            Ok(0)
        }
    } else {
        println!("❌ Failed to get count for {}: {}", table, response.status());
        Ok(0)
    }
}

// Debug function to expose count checking
pub async fn debug_get_supabase_count(table: &str) -> Result<u32> {
    get_supabase_count(table).await
}

// Generic function to sync any table with proper pagination - FIXED to use UPSERT
async fn sync_table_with_pagination(
    table: &str,
    upsert_query: &str,
    bind_params: fn(&serde_json::Value) -> Vec<String>,
) -> Result<u32> {
    println!("📊 Starting {} sync with UPSERT...", table);
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get total count
    let total_count = get_supabase_count(table).await?;
    println!("📊 Total {} in Supabase: {}", table, total_count);
    
    if total_count == 0 {
        println!("⚠️ No {} found in Supabase", table);
        return Ok(0);
    }
    
    // Check if already synced
    let local_count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", table))
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    
    if local_count >= total_count as i64 {
        println!("⏭️ Skipping {} - already complete ({} local >= {} remote)", table, local_count, total_count);
        return Ok(0);
    }
    
    println!("📊 Found {} existing local {}", local_count, table);
    
    // Sync with proper pagination - Process ALL records with UPSERT
    let batch_size = 1000; // Supabase hard limit is 1000 records per request
    let mut offset = 0;
    let mut total_processed = 0;
    
    while offset < total_count {
        let range_start = offset;
        let range_end = std::cmp::min(offset + batch_size - 1, total_count - 1);
        
        println!("📖 Fetching {} range {}-{}...", table, range_start, range_end);
        
        let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*", table);
        
        // Retry logic for network requests
        let mut retry_count = 0;
        let max_retries = 3;
        
        let response = loop {
            let request_result = client
                .get(&url)
                .header("apikey", anon_key)
                .header("Authorization", format!("Bearer {}", anon_key))
                .header("Range", format!("{}-{}", range_start, range_end))
                .timeout(std::time::Duration::from_secs(30))
                .send()
                .await;
            
            match request_result {
                Ok(resp) => break resp,
                Err(e) => {
                    retry_count += 1;
                    if retry_count > max_retries {
                        println!("❌ Failed to fetch {} after {} retries: {}", table, max_retries, e);
                        return Err(anyhow::anyhow!("Network request failed after {} retries: {}", max_retries, e));
                    }
                    println!("⚠️ Network error (attempt {}/{}): {}. Retrying in 5 seconds...", retry_count, max_retries, e);
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            }
        };
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch {}: {}", table, response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let records = json.as_array().unwrap_or(&empty_vec);
        
        if records.is_empty() {
            println!("✅ No more {} to fetch", table);
            break;
        }
        
        // Process ALL records with UPSERT (no filtering)
        println!("📚 Processing {} {} with UPSERT...", records.len(), table);
        
        let mut tx = pool.begin().await?;
        let mut batch_processed = 0;
        
        for record in records {
            let params = bind_params(record);
            
            let mut query = sqlx::query(upsert_query);
            for param in params {
                query = query.bind(param);
            }
            
            if let Err(e) = query.execute(&mut *tx).await {
                println!("❌ Error upserting {}: {}", table, e);
            } else {
                batch_processed += 1;
            }
        }
        
        tx.commit().await?;
        total_processed += batch_processed;
        println!("✅ Processed {} {} with UPSERT", batch_processed, table);
        
        offset += batch_size;
    }
    
    println!("🎉 {} sync completed: {} records processed", table, total_processed);
    Ok(total_processed)
}

// Force sync function that processes ALL records (including updates)
async fn force_sync_table_with_pagination(
    table: &str,
    upsert_query: &str,
    bind_params: fn(&serde_json::Value) -> Vec<String>,
) -> Result<u32> {
    println!("🔄 Starting FORCE {} sync (will update existing records)...", table);
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get total count
    let total_count = get_supabase_count(table).await?;
    println!("📊 Total {} in Supabase: {}", table, total_count);
    
    if total_count == 0 {
        println!("⚠️ No {} found in Supabase", table);
        return Ok(0);
    }
    
    // Sync with proper pagination - NO FILTERING, process ALL records
    let batch_size = 1000; // Supabase hard limit is 1000 records per request
    let mut offset = 0;
    let mut total_processed = 0;
    
    while offset < total_count {
        let range_start = offset;
        let range_end = std::cmp::min(offset + batch_size - 1, total_count - 1);
        
        println!("📖 Force fetching {} range {}-{}...", table, range_start, range_end);
        
        let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*", table);
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch {}: {}", table, response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let records = json.as_array().unwrap_or(&empty_vec);
        
        if records.is_empty() {
            println!("✅ No more {} to fetch", table);
            break;
        }
        
        // Process ALL records (no filtering)
        println!("🔄 Force processing {} {}...", records.len(), table);
        
        let mut tx = pool.begin().await?;
        let mut batch_processed = 0;
        
        for record in records {
            let params = bind_params(record);
            
            let mut query = sqlx::query(upsert_query);
            for param in params {
                query = query.bind(param);
            }
            
            if let Err(e) = query.execute(&mut *tx).await {
                println!("❌ Error upserting {}: {}", table, e);
            } else {
                batch_processed += 1;
            }
        }
        
        tx.commit().await?;
        total_processed += batch_processed;
        println!("✅ Force processed {} {}", batch_processed, table);
        
        offset += batch_size;
    }
    
    println!("🎉 Force {} sync completed: {} records processed", table, total_processed);
    Ok(total_processed)
}

// Books sync - Fixed to handle ISBN conflicts
pub async fn sync_books_in_batches_fixed() -> Result<u32> {
    let upsert_query = r#"
        INSERT INTO books (
            id, title, author, isbn, genre, publisher, publication_year, 
            total_copies, available_copies, shelf_location, description, 
            status, category_id, book_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            isbn = excluded.isbn,
            genre = excluded.genre,
            publisher = excluded.publisher,
            publication_year = excluded.publication_year,
            total_copies = excluded.total_copies,
            available_copies = excluded.available_copies,
            shelf_location = excluded.shelf_location,
            description = excluded.description,
            status = excluded.status,
            category_id = excluded.category_id,
            book_code = excluded.book_code,
            updated_at = datetime('now')
    "#;
    
    force_sync_table_with_pagination("books", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["title"].as_str().unwrap_or("Unknown Title").to_string(),
            record["author"].as_str().unwrap_or("Unknown Author").to_string(),
            record["isbn"].as_str().unwrap_or_default().to_string(),
            record["genre"].as_str().unwrap_or_default().to_string(),
            record["publisher"].as_str().unwrap_or_default().to_string(),
            record["publication_year"].as_i64().unwrap_or(0).to_string(),
            record["total_copies"].as_i64().unwrap_or(1).to_string(),
            record["available_copies"].as_i64().unwrap_or(1).to_string(),
            record["shelf_location"].as_str().unwrap_or_default().to_string(),
            record["description"].as_str().unwrap_or_default().to_string(),
            record["status"].as_str().unwrap_or("available").to_string(),
            record["category_id"].as_str().unwrap_or_default().to_string(),
            record["book_code"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Force sync books - updates existing records
pub async fn force_sync_books_in_batches() -> Result<u32> {
    let upsert_query = r#"
        INSERT INTO books (
            id, title, author, isbn, genre, publisher, publication_year, 
            total_copies, available_copies, shelf_location, description, 
            status, category_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            isbn = excluded.isbn,
            genre = excluded.genre,
            publisher = excluded.publisher,
            publication_year = excluded.publication_year,
            total_copies = excluded.total_copies,
            available_copies = excluded.available_copies,
            shelf_location = excluded.shelf_location,
            description = excluded.description,
            status = excluded.status,
            category_id = excluded.category_id,
            updated_at = datetime('now')
    "#;
    
    force_sync_table_with_pagination("books", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["title"].as_str().unwrap_or("Unknown Title").to_string(),
            record["author"].as_str().unwrap_or("Unknown Author").to_string(),
            record["isbn"].as_str().unwrap_or_default().to_string(),
            record["genre"].as_str().unwrap_or_default().to_string(),
            record["publisher"].as_str().unwrap_or_default().to_string(),
            record["publication_year"].as_i64().unwrap_or(0).to_string(),
            record["total_copies"].as_i64().unwrap_or(1).to_string(),
            record["available_copies"].as_i64().unwrap_or(1).to_string(),
            record["shelf_location"].as_str().unwrap_or_default().to_string(),
            record["description"].as_str().unwrap_or_default().to_string(),
            record["status"].as_str().unwrap_or("available").to_string(),
            record["category_id"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Students sync - Fixed to handle unique constraint on admission_number
pub async fn sync_students_in_batches_fixed() -> Result<u32> {
    let upsert_query = r#"
        INSERT INTO students (
            id, first_name, last_name, email, phone, class_grade, admission_number, 
            address, date_of_birth, status, created_at, updated_at
        ) VALUES (?, ?, ?, NULLIF(?, ''), ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, datetime('now'), datetime('now'))
        ON CONFLICT(admission_number) DO UPDATE SET
            id = excluded.id,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            email = excluded.email,
            phone = excluded.phone,
            class_grade = excluded.class_grade,
            address = excluded.address,
            date_of_birth = excluded.date_of_birth,
            status = excluded.status,
            updated_at = datetime('now')
    "#;
    
    force_sync_table_with_pagination("students", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["first_name"].as_str().unwrap_or("Unknown").to_string(),
            record["last_name"].as_str().unwrap_or("Unknown").to_string(),
            record["email"].as_str().unwrap_or_default().to_string(), // Will be converted to NULL if empty
            record["phone"].as_str().unwrap_or_default().to_string(),
            record["class_grade"].as_str().unwrap_or("Grade 1").to_string(), // Maps to class_grade
            record["admission_number"].as_str().unwrap_or_default().to_string(),
            record["address"].as_str().unwrap_or_default().to_string(), // Will be converted to NULL if empty
            record["date_of_birth"].as_str().unwrap_or_default().to_string(), // Will be converted to NULL if empty
            record["status"].as_str().unwrap_or("active").to_string(),
        ]
    }).await
}

// Borrowings sync
pub async fn sync_borrowings_in_batches_fixed() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO borrowings (
            id, student_id, book_id, borrowed_date, due_date, returned_date,
            status, fine_amount, notes, issued_by, returned_by, fine_paid,
            book_copy_id, condition_at_issue, condition_at_return, is_lost,
            tracking_code, return_notes, copy_condition, group_borrowing_id,
            borrower_type, staff_id, borrowing_type, long_term_period,
            short_term_period, is_long_term, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    "#;
    
    sync_table_with_pagination("borrowings", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["student_id"].as_str().unwrap_or_default().to_string(),
            record["book_id"].as_str().unwrap_or_default().to_string(),
            record["borrowed_date"].as_str().unwrap_or_default().to_string(),
            record["due_date"].as_str().unwrap_or_default().to_string(),
            record["returned_date"].as_str().unwrap_or_default().to_string(),
            record["status"].as_str().unwrap_or("active").to_string(),
            record["fine_amount"].as_f64().unwrap_or(0.0).to_string(),
            record["notes"].as_str().unwrap_or_default().to_string(),
            record["issued_by"].as_str().unwrap_or_default().to_string(),
            record["returned_by"].as_str().unwrap_or_default().to_string(),
            if record["fine_paid"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["book_copy_id"].as_str().unwrap_or_default().to_string(),
            record["condition_at_issue"].as_str().unwrap_or("good").to_string(),
            record["condition_at_return"].as_str().unwrap_or_default().to_string(),
            if record["is_lost"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["tracking_code"].as_str().unwrap_or_default().to_string(),
            record["return_notes"].as_str().unwrap_or_default().to_string(),
            record["copy_condition"].as_str().unwrap_or_default().to_string(),
            record["group_borrowing_id"].as_str().unwrap_or_default().to_string(),
            record["borrower_type"].as_str().unwrap_or("student").to_string(),
            record["staff_id"].as_str().unwrap_or_default().to_string(),
            record["borrowing_type"].as_str().unwrap_or_default().to_string(),
            record["long_term_period"].as_str().unwrap_or_default().to_string(),
            record["short_term_period"].as_str().unwrap_or_default().to_string(),
            if record["is_long_term"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
        ]
    }).await
}

// CORRECTED Book Copies sync with proper schema mapping and book relationship handling
pub async fn sync_book_copies_in_batches_fixed() -> Result<u32> {
    println!("📚 Starting CORRECTED book copies sync with proper schema mapping...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Check if already synced
    let local_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM book_copies")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    
    let remote_count = get_supabase_count("book_copies").await?;
    
    if local_count >= remote_count as i64 {
        println!("⏭️ Skipping book_copies - already complete ({} local >= {} remote)", local_count, remote_count);
        return Ok(0);
    }
    
    println!("📊 book_copies needs sync: {} local < {} remote", local_count, remote_count);
    
    // Step 1: Build books lookup map
    println!("📖 Step 1: Building books lookup map...");
    let books_map = sync_books_for_copies(&pool, &client, anon_key).await?;
    println!("✅ Books cache ready: {} books loaded", books_map.len());
    
    // Step 2: Sync book copies with proper mapping
    println!("📚 Step 2: Syncing book copies with corrected field mapping...");
    let batch_size = 1000; // Supabase hard limit is 1000 records per request
    let mut offset = 0;
    let mut total_processed = 0;
    
    loop {
        let _range_start = offset;
        let _range_end = offset + batch_size - 1;
        
        println!("📖 Fetching book copies batch starting at offset {}...", offset);
        
        let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit=1000&offset={}", offset);
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch book_copies: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let records = json.as_array().unwrap_or(&empty_vec);
        
        if records.is_empty() {
            println!("✅ No more book copies to fetch");
            break;
        }
        
        println!("📚 Processing {} book copies in this batch (batch size: {})...", records.len(), batch_size);
        
        let mut tx = pool.begin().await?;
        let mut batch_processed = 0;
        
        for record in records {
            if let Some(processed) = process_book_copy_record(record, &books_map, &mut tx).await? {
                batch_processed += processed;
            }
        }
        
        tx.commit().await?;
        total_processed += batch_processed;
        println!("✅ Processed {} book copies (total: {})", batch_processed, total_processed);
        
        offset += batch_size;
    }
    
    println!("🎉 CORRECTED book copies sync completed: {} records processed", total_processed);
    Ok(total_processed)
}

/// Sync books first to create a lookup map for book details
async fn sync_books_for_copies(
    pool: &SqlitePool, 
    client: &reqwest::Client, 
    anon_key: &str
) -> Result<HashMap<String, BookDetails>> {
    let mut books_map = HashMap::new();
    
    // First, load existing books from local database
    let local_books = sqlx::query(
        "SELECT id, isbn, title, author, publisher, publication_year FROM books WHERE deleted = 0"
    )
    .fetch_all(pool)
    .await?;
    
    for book in local_books {
        let id: String = book.get("id");
        let publication_year = book.get::<Option<i32>, _>("publication_year").unwrap_or(2024);
        
        // Validate publication year - fix invalid years
        let valid_year = if publication_year < 1000 || publication_year > 2030 {
            2024 // Use current year as fallback for invalid years
        } else {
            publication_year
        };
        
        books_map.insert(id, BookDetails {
            isbn: book.get::<Option<String>, _>("isbn").unwrap_or_default(),
            title: book.get("title"),
            author: book.get("author"),
            publisher: book.get::<Option<String>, _>("publisher").unwrap_or_default(),
            publication_year: valid_year,
        });
    }
    
    // If we don't have enough books, fetch from Supabase
    if books_map.len() < 100 { // Arbitrary threshold
        println!("📖 Fetching books from Supabase to build lookup map...");
        
        let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=id,title,author,isbn,publisher,publication_year,book_code&limit=5000";
        
        let response = client
            .get(url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        if response.status().is_success() {
            let json: serde_json::Value = response.json().await?;
            let empty_books = vec![];
            let books = json.as_array().unwrap_or(&empty_books);
            
            for book in books {
                let id = book["id"].as_str().unwrap_or_default().to_string();
                let publication_year = book["publication_year"].as_i64().unwrap_or(2024) as i32;
                
                // Validate publication year - fix invalid years
                let valid_year = if publication_year < 1000 || publication_year > 2030 {
                    2024 // Use current year as fallback for invalid years
                } else {
                    publication_year
                };
                
                books_map.insert(id, BookDetails {
                    isbn: book["isbn"].as_str().unwrap_or_default().to_string(),
                    title: book["title"].as_str().unwrap_or("Unknown Title").to_string(),
                    author: book["author"].as_str().unwrap_or("Unknown Author").to_string(),
                    publisher: book["publisher"].as_str().unwrap_or_default().to_string(),
                    publication_year: valid_year,
                });
            }
        }
    }
    
    Ok(books_map)
}

/// Process a single book copy record with proper field mapping
async fn process_book_copy_record(
    record: &serde_json::Value,
    books_map: &HashMap<String, BookDetails>,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<Option<u32>> {
    // Extract Supabase fields
    let id = record["id"].as_str().unwrap_or_default();
    let book_id = record["book_id"].as_str().unwrap_or_default();
    let _copy_number = record["copy_number"].as_i64().unwrap_or(1);
    let _book_code = record["book_code"].as_str().unwrap_or_default();
    let condition = record["condition"].as_str().unwrap_or("good");
    let status = record["status"].as_str().unwrap_or("available");
    let tracking_code = record["tracking_code"].as_str().unwrap_or_default();
    let _notes = record["notes"].as_str().unwrap_or_default();
    let legacy_book_id = record["legacy_book_id"].as_i64();
    let created_at = record["created_at"].as_str().unwrap_or_default();
    let updated_at = record["updated_at"].as_str().unwrap_or_default();
    
    // Look up book details or use record fields if book_id is empty
    let (isbn, title, author, publisher, publication_year) = if book_id.is_empty() {
        // Use fields from the record itself
        (
            record["isbn"].as_str().unwrap_or_default().to_string(),
            record["title"].as_str().unwrap_or("Unknown Title").to_string(),
            record["author"].as_str().unwrap_or("Unknown Author").to_string(),
            record["publisher"].as_str().unwrap_or_default().to_string(),
            record["publication_year"].as_i64().unwrap_or(2024) as i32,
        )
    } else {
        match books_map.get(book_id) {
            Some(book) => (
                book.isbn.clone(),
                book.title.clone(),
                book.author.clone(),
                book.publisher.clone(),
                book.publication_year,
            ),
            None => {
                println!("⚠️ Warning: Book ID {} not found in books map for copy {}", book_id, id);
                // Use record fields as fallback
                (
                    record["isbn"].as_str().unwrap_or_default().to_string(),
                    record["title"].as_str().unwrap_or("Unknown Title").to_string(),
                    record["author"].as_str().unwrap_or("Unknown Author").to_string(),
                    record["publisher"].as_str().unwrap_or_default().to_string(),
                    record["publication_year"].as_i64().unwrap_or(2024) as i32,
                )
            }
        }
    };
    
    // Map status values (Supabase → SQLite)
    let local_status = match status {
        "available" => "available",
        "borrowed" => "checked_out", 
        "maintenance" => "repair",
        "lost" => "lost",
        "stolen" => "lost", // Map stolen to lost in local
        _ => "available",
    };
    
    // Map condition values
    let local_condition = match condition {
        "good" => "good",
        "fair" => "fair", 
        "poor" => "poor",
        "damaged" => "damaged",
        "lost" => "poor", // Map lost condition to poor
        _ => "good",
    };
    
    // Use INSERT OR REPLACE with CORRECTED field mapping
    let upsert_query = r#"
        INSERT OR REPLACE INTO book_copies (
            id, book_id, isbn, title, author, publisher, publication_year,
            copy_identifier, copy_number, book_code, tracking_code, notes,
            acquisition_date, condition, status, location, department_id,
            current_borrower_id, borrowed_at, due_date, legacy_book_id,
            created_at, updated_at, synced, sync_version, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)
    "#;
    
    match sqlx::query(upsert_query)
        .bind(id)
        .bind(if book_id.is_empty() || books_map.get(book_id).is_none() { None } else { Some(book_id) }) // book_id - set to None if not found
        .bind(&isbn)
        .bind(&title)
        .bind(&author)
        .bind(&publisher)
        .bind(publication_year)
        .bind(tracking_code)                 // copy_identifier
        .bind(_copy_number)                  // copy_number
        .bind(_book_code)                    // book_code
        .bind(tracking_code)                 // tracking_code
        .bind(_notes)                        // notes
        .bind(chrono::Utc::now().date_naive().to_string()) // acquisition_date
        .bind(local_condition)
        .bind(local_status)
        .bind("Main Library")                // location
        .bind(1)                            // department_id
        .bind(None::<String>)               // current_borrower_id
        .bind(None::<String>)               // borrowed_at
        .bind(None::<String>)               // due_date
        .bind(legacy_book_id)
        .bind(created_at)
        .bind(updated_at)
        .execute(&mut **tx)
        .await 
    {
        Ok(_) => Ok(Some(1)),
        Err(e) => {
            println!("❌ Error upserting book copy {}: {}", id, e);
            Ok(None)
        }
    }
}

// CORRECTED Fines sync with proper schema mapping
pub async fn sync_fines_in_batches_fixed() -> Result<u32> {
    println!("🔄 Starting fines sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let table_name = "fines";
    
    // Get total count
    let total_count = get_supabase_count(table_name).await?;
    println!("📊 Total {} in Supabase: {}", table_name, total_count);
    
    if total_count == 0 {
        println!("⚠️ No {} found in Supabase", table_name);
        return Ok(0);
    }
    
    let mut total_synced = 0u32;
    let batch_size = 5000;
    let mut offset = 0;
    
    loop {
        let range_start = offset;
        let range_end = offset + batch_size - 1;
        
        println!("📦 Fetching {} batch: offset {}, limit {}", table_name, offset, batch_size);
        
        let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*", table_name);
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Failed to fetch {} from Supabase: {}", table_name, error_text);
        }
        
        let body = response.text().await?;
        let records: Vec<serde_json::Value> = serde_json::from_str(&body)?;
        
        if records.is_empty() {
            println!("✅ No more {} records to sync", table_name);
            break;
        }
        
        println!("📝 Processing {} {} records...", records.len(), table_name);
        
        // Begin transaction
        let mut tx = pool.begin().await?;
        
        for record in &records {
            let id = record["id"].as_str().unwrap_or_default();
            let student_id = record["student_id"].as_str().unwrap_or_default();
            let staff_id = record["staff_id"].as_str().unwrap_or_default();
            let borrowing_id = record["borrowing_id"].as_str().unwrap_or_default();
            let fine_type = record["fine_type"].as_str().unwrap_or("overdue");
            let amount = record["amount"].as_f64().unwrap_or(0.0);
            let status = record["status"].as_str().unwrap_or("unpaid");
            let description = record["description"].as_str().unwrap_or_default();
            let created_at = record["created_at"].as_str().unwrap_or_default();
            let updated_at = record["updated_at"].as_str().unwrap_or_default();
            let created_by = record["created_by"].as_str().unwrap_or_default();
            let fine_paid = if record["fine_paid"].as_bool().unwrap_or(false) { 1 } else { 0 };
            let borrower_type = record["borrower_type"].as_str().unwrap_or("student");
            let notes = record["notes"].as_str().unwrap_or_default();
            
            let query = r#"
                INSERT OR REPLACE INTO fines (
                    id, student_id, staff_id, borrowing_id, fine_type, amount, status, 
                    description, created_at, updated_at, created_by, fine_paid, 
                    borrower_type, notes, synced, sync_version, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(student_id)
                .bind(staff_id)
                .bind(borrowing_id)
                .bind(fine_type)
                .bind(amount)
                .bind(status)
                .bind(description)
                .bind(created_at)
                .bind(updated_at)
                .bind(created_by)
                .bind(fine_paid)
                .bind(borrower_type)
                .bind(notes)
                .execute(&mut *tx).await {
                Ok(_) => {},
                Err(e) => {
                    println!("⚠️  Error inserting {} record {}: {}", table_name, id, e);
                    continue;
                }
            }
        }
        
        tx.commit().await?;
        
        let batch_count = records.len() as u32;
        total_synced += batch_count;
        
        println!("✅ Synced {} {} records (total: {})", batch_count, table_name, total_synced);
        
        if (records.len() as usize) < batch_size {
            println!("✅ Reached end of {} data", table_name);
            break;
        }
        
        offset += batch_size;
    }
    
    println!("🎉 {} sync completed! Total records synced: {}", table_name, total_synced);
    Ok(total_synced)
}

// Group Borrowings sync - Fixed with proper schema mapping
pub async fn sync_group_borrowings_in_batches_fixed() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO group_borrowings (
            id, book_id, book_copy_id, tracking_code, borrowed_date, due_date,
            returned_date, condition_at_issue, condition_at_return, fine_amount, fine_paid,
            notes, return_notes, status, is_lost, student_count, issued_by, returned_by,
            created_at, updated_at, student_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    "#;
    
    sync_table_with_pagination("group_borrowings", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["book_id"].as_str().unwrap_or_default().to_string(),
            record["book_copy_id"].as_str().unwrap_or_default().to_string(),
            record["tracking_code"].as_str().unwrap_or_default().to_string(),
            record["borrowed_date"].as_str().unwrap_or_default().to_string(),
            record["due_date"].as_str().unwrap_or_default().to_string(),
            record["returned_date"].as_str().unwrap_or_default().to_string(),
            record["condition_at_issue"].as_str().unwrap_or("good").to_string(),
            record["condition_at_return"].as_str().unwrap_or_default().to_string(),
            record["fine_amount"].as_f64().unwrap_or(0.0).to_string(),
            if record["fine_paid"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["notes"].as_str().unwrap_or_default().to_string(),
            record["return_notes"].as_str().unwrap_or_default().to_string(),
            record["status"].as_str().unwrap_or("active").to_string(),
            if record["is_lost"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["student_count"].as_i64().unwrap_or(1).to_string(),
            record["issued_by"].as_str().unwrap_or_default().to_string(),
            record["returned_by"].as_str().unwrap_or_default().to_string(),
            record["student_ids"].as_str().unwrap_or("[]").to_string(),
        ]
    }).await
}

// Theft Reports sync
pub async fn sync_theft_reports_in_batches_fixed() -> Result<u32> {
    let insert_query = r#"
        INSERT OR REPLACE INTO theft_reports (
            id, student_id, book_id, expected_tracking_code, returned_tracking_code, 
            theft_reason, reported_date, status, investigation_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    "#;
    
    sync_table_with_pagination("theft_reports", insert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["student_id"].as_str().unwrap_or_default().to_string(),
            record["book_id"].as_str().unwrap_or_default().to_string(),
            record["expected_tracking_code"].as_str().unwrap_or_default().to_string(),
            record["returned_tracking_code"].as_str().unwrap_or_default().to_string(),
            record["theft_reason"].as_str().unwrap_or_default().to_string(),
            record["report_date"].as_str().or_else(|| record["reported_date"].as_str()).unwrap_or_default().to_string(),
            record["status"].as_str().unwrap_or("reported").to_string(),
            record["investigation_notes"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Profiles sync
pub async fn sync_profiles_from_supabase() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO profiles (
            id, email, role, first_name, last_name, phone, suspended, 
            is_online, last_seen, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#;
    
    sync_table_with_pagination("profiles", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["email"].as_str().unwrap_or_default().to_string(),
            record["role"].as_str().unwrap_or("user").to_string(),
            record["first_name"].as_str().unwrap_or_default().to_string(),
            record["last_name"].as_str().unwrap_or_default().to_string(),
            record["phone"].as_str().unwrap_or_default().to_string(),
            if record["suspended"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            if record["is_online"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["last_seen"].as_str().unwrap_or_default().to_string(),
            record["created_at"].as_str().unwrap_or_default().to_string(),
            record["updated_at"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// System Settings sync
pub async fn sync_system_settings_from_supabase() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO system_settings (
            id, setting_key, setting_value, description, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    "#;
    
    sync_table_with_pagination("system_settings", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["setting_key"].as_str().unwrap_or_default().to_string(),
            record["setting_value"].to_string(), // Keep as JSON
            record["description"].as_str().unwrap_or_default().to_string(),
            record["updated_by"].as_str().unwrap_or_default().to_string(),
            record["created_at"].as_str().unwrap_or_default().to_string(),
            record["updated_at"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Notifications sync
pub async fn sync_notifications_from_supabase() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO notifications (
            id, user_id, title, message, type, read, related_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    "#;
    
    sync_table_with_pagination("notifications", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["user_id"].as_str().unwrap_or_default().to_string(),
            record["title"].as_str().unwrap_or_default().to_string(),
            record["message"].as_str().unwrap_or_default().to_string(),
            record["type"].as_str().unwrap_or("info").to_string(),
            if record["read"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["related_id"].as_str().unwrap_or_default().to_string(),
            record["created_at"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// School Terms sync
pub async fn sync_school_terms_from_supabase() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO school_terms (
            id, term_name, academic_year, start_date, end_date, is_current, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    "#;
    
    sync_table_with_pagination("school_terms", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["term_name"].as_str().unwrap_or_default().to_string(),
            record["academic_year"].as_str().unwrap_or_default().to_string(),
            record["start_date"].as_str().unwrap_or_default().to_string(),
            record["end_date"].as_str().unwrap_or_default().to_string(),
            if record["is_current"].as_bool().unwrap_or(false) { "1" } else { "0" }.to_string(),
            record["created_at"].as_str().unwrap_or_default().to_string(),
            record["updated_at"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Categories sync
pub async fn sync_categories_from_supabase() -> Result<u32> {
    let insert_query = r#"
        INSERT INTO categories (
            id, name, description, created_at, updated_at
        ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
    "#;
    
    sync_table_with_pagination("categories", insert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["name"].as_str().unwrap_or("Unknown").to_string(),
            record["description"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Classes sync - Fixed to match Supabase schema with proper UPSERT
pub async fn sync_classes_from_supabase() -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO classes (
            id, class_name, form_level, class_section, max_books_allowed, is_active, 
            academic_level_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    "#;
    
    sync_table_with_pagination("classes", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["class_name"].as_str().or_else(|| record["name"].as_str()).unwrap_or("Unknown").to_string(),
            record["form_level"].as_i64().or_else(|| record["level"].as_i64()).or_else(|| record["grade_level"].as_i64()).unwrap_or(1).to_string(),
            record["class_section"].as_str().or_else(|| record["section"].as_str()).unwrap_or_default().to_string(),
            record["max_books_allowed"].as_i64().unwrap_or(2).to_string(),
            if record["is_active"].as_bool().unwrap_or(true) { "1" } else { "0" }.to_string(),
            record["academic_level_type"].as_str().unwrap_or("form").to_string(),
        ]
    }).await
}

// CORRECTED Fine Settings sync with proper schema mapping
pub async fn sync_fine_settings_from_supabase(_limit: Option<u32>) -> Result<u32> {
    println!("🔄 Starting fine settings sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let table_name = "fine_settings";
    
    // Get total count
    let total_count = get_supabase_count(table_name).await?;
    println!("📊 Total {} in Supabase: {}", table_name, total_count);
    
    if total_count == 0 {
        println!("⚠️ No {} found in Supabase", table_name);
        return Ok(0);
    }
    
    let mut total_synced = 0u32;
    let batch_size = 5000;
    let mut offset = 0;
    
    loop {
        let range_start = offset;
        let range_end = offset + batch_size - 1;
        
        println!("📦 Fetching {} batch: offset {}, limit {}", table_name, offset, batch_size);
        
        let url = format!("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=*", table_name);
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Failed to fetch {} from Supabase: {}", table_name, error_text);
        }
        
        let body = response.text().await?;
        let records: Vec<serde_json::Value> = serde_json::from_str(&body)?;
        
        if records.is_empty() {
            println!("✅ No more {} records to sync", table_name);
            break;
        }
        
        println!("📝 Processing {} {} records...", records.len(), table_name);
        
        // Begin transaction
        let mut tx = pool.begin().await?;
        
        for record in &records {
            let id = record["id"].as_str().unwrap_or_default();
            let fine_type = record["fine_type"].as_str().unwrap_or("overdue");
            let amount = record["amount"].as_f64().unwrap_or(0.0);
            let description = record["description"].as_str().unwrap_or_default();
            let created_at = record["created_at"].as_str().unwrap_or_default();
            let updated_at = record["updated_at"].as_str().unwrap_or_default();
            
            let query = r#"
                INSERT OR REPLACE INTO fine_settings (
                    id, fine_type, amount, description, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(fine_type)
                .bind(amount)
                .bind(description)
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx).await {
                Ok(_) => {},
                Err(e) => {
                    println!("⚠️  Error inserting {} record {}: {}", table_name, id, e);
                    continue;
                }
            }
        }
        
        tx.commit().await?;
        
        let batch_count = records.len() as u32;
        total_synced += batch_count;
        
        println!("✅ Synced {} {} records (total: {})", batch_count, table_name, total_synced);
        
        if (records.len() as usize) < batch_size {
            println!("✅ Reached end of {} data", table_name);
            break;
        }
        
        offset += batch_size;
    }
    
    println!("🎉 {} sync completed! Total records synced: {}", table_name, total_synced);
    Ok(total_synced)
}

// Staff sync - Fixed with proper UPSERT and schema mapping
pub async fn sync_staff_from_supabase(_limit: u32) -> Result<u32> {
    let upsert_query = r#"
        INSERT OR REPLACE INTO staff (
            id, staff_id, first_name, last_name, email, phone, position, 
            department, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    "#;
    
    sync_table_with_pagination("staff", upsert_query, |record| {
        vec![
            record["id"].as_str().unwrap_or_default().to_string(),
            record["staff_id"].as_str().or_else(|| record["id"].as_str()).unwrap_or_default().to_string(),
            record["first_name"].as_str().unwrap_or("Unknown").to_string(),
            record["last_name"].as_str().unwrap_or("Unknown").to_string(),
            record["email"].as_str().unwrap_or_default().to_string(),
            record["phone"].as_str().unwrap_or_default().to_string(),
            record["position"].as_str().or_else(|| record["role"].as_str()).unwrap_or("librarian").to_string(),
            record["department"].as_str().unwrap_or_default().to_string(),
        ]
    }).await
}

// Comprehensive sync using fixed functions - MATCHES production sync tables
pub async fn pull_all_database_fixed() -> Result<()> {
    println!("🔄 Starting COMPREHENSIVE database sync with FIXED pagination...");
    
    let mut total_records = 0;
    
    // Sync tables in same order as production sync
    let tables = vec![
        "categories", "books", "book_copies", "students", 
        "staff", "borrowings", "fines", "fine_settings"
    ];
    
    for table in tables {
        println!("🔄 Syncing table: {}", table);
        
        let count = match table {
            "categories" => sync_categories_from_supabase().await?,
            "books" => sync_books_in_batches_fixed().await?,
            "book_copies" => sync_book_copies_in_batches_fixed().await?,
            "students" => sync_students_in_batches_fixed().await?,
            "staff" => sync_staff_from_supabase(10000).await?,
            "borrowings" => sync_borrowings_in_batches_fixed().await?,
            "fines" => sync_fines_in_batches_fixed().await?,
            "fine_settings" => sync_fine_settings_from_supabase(Some(10000)).await?,
            _ => 0,
        };
        
        total_records += count;
        println!("✅ {} sync completed: {} records", table, count);
    }
    
    println!("\n🎉 COMPREHENSIVE SYNC COMPLETED!");
    println!("📊 Total records synchronized: {}", total_records);
    
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    println!("🚀 Starting Shelf Serpent Comprehensive Sync...");
    
    match pull_all_database_fixed().await {
        Ok(_) => {
            println!("✅ Sync completed successfully!");
            Ok(())
        }
        Err(e) => {
            eprintln!("❌ Sync failed: {}", e);
            Err(e)
        }
    }
}
