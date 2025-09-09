use std::path::PathBuf;
use anyhow::Result;
use sqlx::{sqlite::SqlitePool, Row};

#[tokio::main]
async fn main() -> Result<()> {
    println!("🔄 Starting manual data sync from Supabase...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("shelf-serpent");
        
    let db_path = app_dir.join("library.db");
    println!("📁 Database path: {:?}", db_path);
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Manual sync - fetch books from Supabase and insert into local database
    let client = reqwest::Client::new();
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books?select=*&limit=100";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    println!("📡 Fetching books from Supabase...");
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        println!("❌ Failed to fetch from Supabase: {}", response.status());
        return Ok(());
    }
    
    let json: serde_json::Value = response.json().await?;
    
    if let Some(books) = json.as_array() {
        println!("📚 Found {} books in Supabase", books.len());
        
        let mut inserted = 0;
        for book in books {
            let id = book["id"].as_str().unwrap_or_default();
            let title = book["title"].as_str().unwrap_or("Unknown Title");
            let author = book["author"].as_str().unwrap_or("Unknown Author");
            let isbn = book["isbn"].as_str();
            let publisher = book["publisher"].as_str();
            let publication_year = book["publication_year"].as_i64();
            let total_copies = book["total_copies"].as_i64().unwrap_or(1);
            let available_copies = book["available_copies"].as_i64().unwrap_or(1);
            
            // Insert into local database
            let query = r#"
                INSERT OR REPLACE INTO books (
                    id, title, author, isbn, publisher, publication_year, 
                    total_copies, available_copies, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', datetime('now'), datetime('now'))
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(title)
                .bind(author)
                .bind(isbn)
                .bind(publisher)
                .bind(publication_year)
                .bind(total_copies)
                .bind(available_copies)
                .execute(&pool)
                .await
            {
                Ok(_) => {
                    inserted += 1;
                    if inserted % 10 == 0 {
                        println!("✅ Inserted {} books...", inserted);
                    }
                }
                Err(e) => {
                    println!("❌ Failed to insert book '{}': {}", title, e);
                }
            }
        }
        
        println!("🎉 Successfully inserted {} books into local database!", inserted);
    }
    
    // Now fetch categories
    println!("📡 Fetching categories from Supabase...");
    
    let categories_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=*";
    let categories_response = client
        .get(categories_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if let Ok(categories_json) = categories_response.json::<serde_json::Value>().await {
        if let Some(categories) = categories_json.as_array() {
            println!("📂 Found {} categories in Supabase", categories.len());
            
            let mut inserted_categories = 0;
            for category in categories {
                let id = category["id"].as_str().unwrap_or_default();
                let name = category["name"].as_str().unwrap_or("Unknown Category");
                let description = category["description"].as_str();
                
                let query = r#"
                    INSERT OR REPLACE INTO categories (
                        id, name, description, created_at, updated_at
                    ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
                "#;
                
                if let Ok(_) = sqlx::query(query)
                    .bind(id)
                    .bind(name)
                    .bind(description)
                    .execute(&pool)
                    .await
                {
                    inserted_categories += 1;
                }
            }
            
            println!("🎉 Successfully inserted {} categories into local database!", inserted_categories);
        }
    }
    
    // Verify the sync worked
    println!("\n📊 Verifying local database after sync...");
    let tables = ["books", "students", "categories", "borrowings", "book_copies"];
    
    for table in tables {
        let query = format!("SELECT COUNT(*) as count FROM {}", table);
        if let Ok(row) = sqlx::query(&query).fetch_one(&pool).await {
            let count: i64 = row.get("count");
            println!("📋 Table '{}': {} records", table, count);
        }
    }
    
    pool.close().await;
    println!("✅ Manual sync completed!");
    
    Ok(())
}
