use std::path::PathBuf;
use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("shelf-serpent");
        
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)?;
    }
    
    let db_path = app_dir.join("library.db");
    println!("Database path: {:?}", db_path);
    
    // Check if database exists and if it has data
    if db_path.exists() {
        // Open SQLite connection
        use sqlx::{sqlite::SqlitePool, Row};
        
        let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
        
        // Check each table
        let tables = ["books", "students", "categories", "borrowings", "book_copies"];
        
        for table in tables {
            let query = format!("SELECT COUNT(*) as count FROM {} LIMIT 1", table);
            match sqlx::query(&query).fetch_one(&pool).await {
                Ok(row) => {
                    let count: i64 = row.get("count");
                    println!("Table '{}': {} records", table, count);
                }
                Err(e) => {
                    println!("Table '{}': Error or doesn't exist - {}", table, e);
                }
            }
        }
        
        pool.close().await;
    } else {
        println!("Database file does not exist");
    }
    
    // Test Supabase connection
    println!("\nTesting Supabase connection...");
    
    let client = reqwest::Client::new();
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    match client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await
    {
        Ok(response) => {
            println!("Supabase connection: SUCCESS (Status: {})", response.status());
            
            if let Ok(json) = response.json::<serde_json::Value>().await {
                if let Some(array) = json.as_array() {
                    println!("Books in Supabase: {} records", array.len());
                } else {
                    println!("Unexpected response format");
                }
            }
        }
        Err(e) => {
            println!("Supabase connection: FAILED - {}", e);
        }
    }
    
    Ok(())
}
