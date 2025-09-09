use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;
use tauri_app_lib::sync_all_fixed::sync_book_copies_in_batches_fixed;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🔍 DEBUG: Testing CORRECTED book copies sync...");
    
    // Step 1: Check current counts
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let local_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM book_copies")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    
    println!("📊 Current local book copies: {}", local_count);
    
    // Check for placeholder data (old sync artifacts)
    let placeholder_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM book_copies WHERE title LIKE 'Book Copy %' OR author = 'Unknown Author'"
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);
    
    println!("⚠️  Book copies with placeholder data: {}", placeholder_count);
    
    // Step 2: Run CORRECTED book copies sync
    println!("🔄 Starting CORRECTED book copies sync...");
    let inserted = sync_book_copies_in_batches_fixed().await?;
    
    // Step 3: Check final count and data quality
    let final_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM book_copies")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    
    let proper_data_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM book_copies WHERE title NOT LIKE 'Book Copy %' AND author != 'Unknown Author'"
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);
    
    let final_placeholder_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM book_copies WHERE title LIKE 'Book Copy %' OR author = 'Unknown Author'"
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);
    
    println!("✅ CORRECTED book copies sync completed!");
    println!("📊 Records processed in this sync: {}", inserted);
    println!("📊 Final local book copies: {}", final_count);
    println!("✅ Book copies with proper book data: {}", proper_data_count);
    println!("⚠️  Book copies still with placeholder data: {}", final_placeholder_count);
    
    // Show sample of corrected data
    let samples = sqlx::query(
        "SELECT id, isbn, title, author, copy_identifier, status, condition 
         FROM book_copies 
         WHERE title NOT LIKE 'Book Copy %' AND author != 'Unknown Author'
         LIMIT 3"
    )
    .fetch_all(&pool)
    .await?;
    
    if !samples.is_empty() {
        println!("\n📋 Sample of CORRECTED book copy data:");
        println!("{}", "=".repeat(80));
        for sample in samples {
            println!("ID: {}", sample.get::<String, _>("id"));
            println!("ISBN: {}", sample.get::<String, _>("isbn"));
            println!("Title: {}", sample.get::<String, _>("title"));
            println!("Author: {}", sample.get::<String, _>("author"));
            println!("Copy ID: {}", sample.get::<Option<String>, _>("copy_identifier").unwrap_or_default());
            println!("Status: {}", sample.get::<String, _>("status"));
            println!("Condition: {}", sample.get::<Option<String>, _>("condition").unwrap_or_default());
            println!("{}", "-".repeat(40));
        }
    }
    
    // Final assessment
    if proper_data_count > final_placeholder_count {
        println!("🎉 SUCCESS: Book copies sync is now working correctly!");
        println!("   Most book copies now have proper book details instead of placeholders.");
    } else if proper_data_count > 0 {
        println!("⚠️  PARTIAL SUCCESS: Some book copies have been corrected.");
        println!("   You may need to run the sync again or check for missing books.");
    } else {
        println!("❌ ISSUE: Book copies still have placeholder data.");
        println!("   Check that books are synced first and book_id relationships exist.");
    }
    
    Ok(())
}
