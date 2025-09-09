use std::path::PathBuf;
use anyhow::Result;
use sqlx::sqlite::SqlitePool;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 DEBUG: Testing all sync functions with fixed pagination...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Test each table
    let tables = vec![
        "books",
        "students", 
        "borrowings",
        "book_copies",
        "fines",
        "group_borrowings",
        "theft_reports"
    ];
    
    for table in tables {
        println!("\n📊 Checking {}...", table);
        
        // Get Supabase count
        let count_url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=count",
            table
        );
        
        let response = client
            .get(&count_url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await?;
        
        let supabase_count = if response.status().is_success() {
            let json: serde_json::Value = response.json().await?;
            json[0]["count"].as_i64().unwrap_or(0) as u32
        } else {
            0
        };
        
        // Get local count
        let local_count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", table))
            .fetch_one(&pool)
            .await?;
        
        println!("📊 {}: Supabase={}, Local={}", table, supabase_count, local_count);
        
        if supabase_count > local_count as u32 {
            println!("⚠️ Missing {} records in local DB", supabase_count - local_count as u32);
        } else {
            println!("✅ Local DB is up to date");
        }
    }
    
    // Test actual sync for books
    println!("\n📚 Testing books sync...");
    let inserted = sync_books_in_batches_fixed().await?;
    println!("✅ Inserted {} books", inserted);
    
    // Test students sync
    println!("\n👥 Testing students sync...");
    let inserted = sync_students_in_batches_fixed().await?;
    println!("✅ Inserted {} students", inserted);
    
    // Test borrowings sync
    println!("\n📋 Testing borrowings sync...");
    let inserted = sync_borrowings_in_batches_fixed().await?;
    println!("✅ Inserted {} borrowings", inserted);
    
    // Test book copies sync
    println!("\n📚 Testing book copies sync...");
    let inserted = sync_book_copies_in_batches_fixed().await?;
    println!("✅ Inserted {} book copies", inserted);
    
    println!("\n🎉 Debug sync test completed!");
    
    Ok(())
}

// Fixed sync functions (copied from sync_all_fixed.rs)

mod sync_all_fixed;

use sync_all_fixed::{
    sync_books_in_batches_fixed, sync_students_in_batches_fixed, sync_borrowings_in_batches_fixed,
    sync_book_copies_in_batches_fixed
};

async fn sync_books_in_batches_fixed_local() -> Result<u32> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get total count
    let count_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=count";
    let response = client
        .get(count_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    let total_count = if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        json[0]["count"].as_i64().unwrap_or(0) as u32
    } else {
        0
    };
    
    println!("📊 Total books in Supabase: {}", total_count);
    
    if total_count == 0 {
        return Ok(0);
    }
    
    // Get existing local IDs
    let existing_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM books")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    
    let existing_ids_set: std::collections::HashSet<String> = existing_ids.into_iter().collect();
    println!("📊 Found {} existing local books", existing_ids_set.len());
    
    // Sync with proper pagination
    let batch_size = 1000;
    let mut offset = 0;
    let mut total_inserted = 0;
    
    while offset < total_count {
        let range_start = offset;
        let range_end = std::cmp::min(offset + batch_size - 1, total_count - 1);
        
        println!("📖 Fetching books range {}-{}...", range_start, range_end);
        
        let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*";
        
        let response = client
            .get(url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch books: {}", response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let books = json.as_array().unwrap_or(&empty_vec);
        
        if books.is_empty() {
            println!("✅ No more books to fetch");
            break;
        }
        
        // Filter out existing records
        let missing_books: Vec<&serde_json::Value> = books
            .iter()
            .filter(|book| {
                let id = book["id"].as_str().unwrap_or_default();
                !existing_ids_set.contains(id)
            })
            .collect();
        
        if missing_books.is_empty() {
            println!("📋 All books in this range already exist");
        } else {
            println!("📚 Processing {} new books...", missing_books.len());
            
            let mut tx = pool.begin().await?;
            let mut batch_inserted = 0;
            
            for book in missing_books {
                let result = sqlx::query(
                    r#"
                    INSERT INTO books (
                        id, title, author, isbn, genre, publisher, publication_year,
                        total_copies, available_copies, shelf_location, description,
                        status, category_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    "#
                )
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
                .execute(&mut *tx)
                .await;
                
                if result.is_ok() {
                    batch_inserted += 1;
                }
            }
            
            tx.commit().await?;
            total_inserted += batch_inserted;
            println!("✅ Inserted {} new books", batch_inserted);
        }
        
        offset += batch_size;
    }
    
    println!("🎉 Books sync completed: {} new records", total_inserted);
    Ok(total_inserted)
}

// Similar fixed functions for other tables would go here...

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_books_sync() {
        let result = sync_books_in_batches_fixed().await;
        assert!(result.is_ok());
        println!("Books sync test: {:?}", result);
    }
}
