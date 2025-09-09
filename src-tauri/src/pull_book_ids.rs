use anyhow::Result;
use std::path::PathBuf;
use sqlx::sqlite::SqlitePool;

#[tokio::main]
async fn main() -> Result<()> {
    println!("📚 Pulling book IDs from database...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Query book IDs with legacy fields
    let book_ids: Vec<(String, String, Option<String>, Option<i32>, Option<String>)> = sqlx::query_as(
        "SELECT id, title, isbn, legacy_book_id, legacy_isbn FROM books ORDER BY title"
    )
    .fetch_all(&pool)
    .await?;
    
    println!("📊 Found {} books:", book_ids.len());
    
    for (id, title, isbn, legacy_id, legacy_isbn) in book_ids {
        println!("ID: {}", id);
        println!("Title: {}", title);
        println!("ISBN: {}", isbn.unwrap_or("No ISBN".to_string()));
        println!("Legacy Book ID: {:?}", legacy_id);
        println!("Legacy ISBN: {:?}", legacy_isbn);
        println!("---");
    }
    
    // Also pull book copies with their IDs and legacy fields
    let book_copies: Vec<(String, String, String, Option<i32>)> = sqlx::query_as(
        "SELECT id, title, copy_identifier, legacy_book_id FROM book_copies ORDER BY title"
    )
    .fetch_all(&pool)
    .await?;
    
    println!("\n📖 Found {} book copies:", book_copies.len());
    
    for (id, title, copy_identifier, legacy_id) in book_copies {
        println!("Copy ID: {}", id);
        println!("Title: {}", title);
        println!("Copy #: {}", copy_identifier);
        println!("Legacy Book ID: {:?}", legacy_id);
        println!("---");
    }
    
    pool.close().await;
    
    Ok(())
}
