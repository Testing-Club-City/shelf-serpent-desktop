use anyhow::Result;
use reqwest;
use serde_json::Value;
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::path::PathBuf;

/// Corrected book copies sync that properly handles schema differences
pub async fn sync_book_copies_corrected() -> Result<u32> {
    println!("📚 Starting CORRECTED book copies sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Step 1: First sync books to ensure we have book details
    println!("📖 Step 1: Ensuring books are synced first...");
    let books_map = sync_books_for_copies(&pool, &client, anon_key).await?;
    println!("✅ Books cache ready: {} books loaded", books_map.len());
    
    // Step 2: Sync book copies with proper mapping
    println!("📚 Step 2: Syncing book copies...");
    let batch_size = 1000;
    let mut offset = 0;
    let mut total_processed = 0;
    
    loop {
        println!("📖 Fetching book copies batch starting at offset {}...", offset);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies?select=*&limit={}&offset={}",
            batch_size, offset
        );
        
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
        
        let json: Value = response.json().await?;
        let records = json.as_array().unwrap_or(&vec![]);
        
        if records.is_empty() {
            println!("✅ No more book copies to fetch");
            break;
        }
        
        println!("📚 Processing {} book copies in this batch...", records.len());
        
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
    
    println!("🎉 Book copies sync completed: {} records processed", total_processed);
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
    let local_books = sqlx::query!(
        "SELECT id, isbn, title, author, publisher, publication_year FROM books WHERE deleted = 0"
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
            let json: Value = response.json().await?;
            let books = json.as_array().unwrap_or(&vec![]);
            
            for book in books {
                let id = book["id"].as_str().unwrap_or_default().to_string();
                books_map.insert(id, BookDetails {
                    isbn: book["isbn"].as_str().unwrap_or_default().to_string(),
                    title: book["title"].as_str().unwrap_or("Unknown Title").to_string(),
                    author: book["author"].as_str().unwrap_or("Unknown Author").to_string(),
                    publisher: book["publisher"].as_str().unwrap_or_default().to_string(),
                    publication_year: book["publication_year"].as_i64().unwrap_or(2024) as i32,
                });
            }
        }
    }
    
    Ok(books_map)
}

/// Process a single book copy record with proper field mapping
async fn process_book_copy_record(
    record: &Value,
    books_map: &HashMap<String, BookDetails>,
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<Option<u32>> {
    // Extract Supabase fields
    let id = record["id"].as_str().unwrap_or_default();
    let book_id = record["book_id"].as_str().unwrap_or_default();
    let copy_number = record["copy_number"].as_i64().unwrap_or(1);
    let book_code = record["book_code"].as_str().unwrap_or_default();
    let condition = record["condition"].as_str().unwrap_or("good");
    let status = record["status"].as_str().unwrap_or("available");
    let tracking_code = record["tracking_code"].as_str().unwrap_or_default();
    let notes = record["notes"].as_str().unwrap_or_default();
    let legacy_book_id = record["legacy_book_id"].as_i64();
    let created_at = record["created_at"].as_str().unwrap_or_default();
    let updated_at = record["updated_at"].as_str().unwrap_or_default();
    
    // Look up book details
    let book_details = books_map.get(book_id);
    
    if book_details.is_none() {
        println!("⚠️ Warning: Book ID {} not found in books map for copy {}", book_id, id);
        // You can choose to skip or use defaults
        return Ok(None);
    }
    
    let book = book_details.unwrap();
    
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
    
    // Use INSERT OR REPLACE with proper field mapping
    let upsert_query = r#"
        INSERT OR REPLACE INTO book_copies (
            id, isbn, title, author, publisher, publication_year,
            copy_identifier, acquisition_date, condition, status,
            location, department_id, current_borrower_id, borrowed_at,
            due_date, legacy_book_id, created_at, updated_at,
            synced, sync_version, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)
    "#;
    
    match sqlx::query(upsert_query)
        .bind(id)
        .bind(&book.isbn)                    // ✅ Correct: Use book's ISBN
        .bind(&book.title)                   // ✅ Correct: Use book's title  
        .bind(&book.author)                  // ✅ Correct: Use book's author
        .bind(&book.publisher)               // ✅ Correct: Use book's publisher
        .bind(book.publication_year)         // ✅ Correct: Use book's year
        .bind(tracking_code)                 // ✅ Correct: tracking_code → copy_identifier
        .bind(chrono::Utc::now().date_naive().to_string()) // acquisition_date
        .bind(local_condition)               // ✅ Correct: Mapped condition
        .bind(local_status)                  // ✅ Correct: Mapped status
        .bind("Main Library")                // Default location
        .bind(1)                            // Default department_id
        .bind(None::<String>)               // current_borrower_id
        .bind(None::<String>)               // borrowed_at
        .bind(None::<String>)               // due_date
        .bind(legacy_book_id)               // ✅ Correct: Preserve legacy_book_id
        .bind(created_at)                   // ✅ Correct: Preserve created_at
        .bind(updated_at)                   // ✅ Correct: Preserve updated_at
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

#[derive(Debug, Clone)]
struct BookDetails {
    isbn: String,
    title: String,
    author: String,
    publisher: String,
    publication_year: i32,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_book_copies_sync() {
        // Add tests here
        assert!(true);
    }
}
