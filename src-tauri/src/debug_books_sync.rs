use anyhow::Result;
use reqwest;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🔍 DEBUG: Checking books sync status...");
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Step 1: Get total count from Supabase
    println!("📊 Step 1: Getting total books count from Supabase...");
    let count_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=count";
    
    let response = client
        .get(count_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    let total_supabase_books = if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        json[0]["count"].as_i64().unwrap_or(0) as u32
    } else {
        println!("❌ Failed to get count: {}", response.status());
        return Ok(());
    };
    
    println!("📊 Total books in Supabase: {}", total_supabase_books);
    
    // Step 2: Get local count
    println!("📊 Step 2: Getting local books count...");
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    let local_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM books")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    
    println!("📊 Total books in local DB: {}", local_count);
    println!("📊 Missing books: {}", total_supabase_books - local_count as u32);
    
    // Step 3: Pull missing books in batches
    if (local_count as u32) < total_supabase_books {
        println!("🔄 Step 3: Pulling missing books...");
        
        let existing_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM books")
            .fetch_all(&pool)
            .await
            .unwrap_or_default();
        
        let existing_ids_set: std::collections::HashSet<String> = existing_ids.into_iter().collect();
        
        let batch_size = 1000; // PostgREST limit
        let mut offset = 0;
        let mut total_inserted = 0;
        
        while offset < total_supabase_books {
            let range_start = offset;
            let range_end = std::cmp::min(offset + batch_size - 1, total_supabase_books - 1);
            
            println!("📖 Fetching range {}-{}...", range_start, range_end);
            
            let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*";
            
            let response = client
                .get(url)
                .header("apikey", anon_key)
                .header("Authorization", format!("Bearer {}", anon_key))
                .header("Range", format!("{}-{}", range_start, range_end))
                .send()
                .await?;
            
            if !response.status().is_success() {
                println!("❌ Failed to fetch range {}-{}: {}", range_start, range_end, response.status());
                break;
            }
            
            let json: serde_json::Value = response.json().await?;
            let empty_vec = vec![];
            let books = json.as_array().unwrap_or(&empty_vec);
            
            if books.is_empty() {
                println!("✅ No more books found");
                break;
            }
            
            let mut new_books = 0;
            let mut tx = pool.begin().await?;
            
            for book in books {
                let id = book["id"].as_str().unwrap_or_default();
                if !existing_ids_set.contains(id) {
                    let title = book["title"].as_str().unwrap_or("Unknown Title");
                    let author = book["author"].as_str().unwrap_or("Unknown Author");
                    let isbn = book["isbn"].as_str();
                    let genre = book["genre"].as_str();
                    let publisher = book["publisher"].as_str();
                    let publication_year = book["publication_year"].as_i64();
                    let total_copies = book["total_copies"].as_i64().unwrap_or(1);
                    let available_copies = book["available_copies"].as_i64().unwrap_or(1);
                    let shelf_location = book["shelf_location"].as_str();
                    let description = book["description"].as_str();
                    let status = book["status"].as_str().unwrap_or("available");
                    let category_id = book["category_id"].as_str();
                    
                    let query = r#"
                        INSERT INTO books (
                            id, title, author, isbn, genre, publisher, publication_year, 
                            total_copies, available_copies, shelf_location, description, 
                            status, category_id, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    "#;
                    
                    if let Err(e) = sqlx::query(query)
                        .bind(id)
                        .bind(title)
                        .bind(author)
                        .bind(isbn)
                        .bind(genre)
                        .bind(publisher)
                        .bind(publication_year)
                        .bind(total_copies)
                        .bind(available_copies)
                        .bind(shelf_location)
                        .bind(description)
                        .bind(status)
                        .bind(category_id)
                        .execute(&mut *tx)
                        .await
                    {
                        println!("❌ Error inserting book {}: {}", id, e);
                    } else {
                        new_books += 1;
                    }
                }
            }
            
            tx.commit().await?;
            total_inserted += new_books;
            println!("✅ Inserted {} new books from range {}-{}", new_books, range_start, range_end);
            
            offset += batch_size;
        }
        
        println!("🎉 Sync completed! Total new books: {}", total_inserted);
    } else {
        println!("✅ All books are already synced!");
    }
    
    Ok(())
}
