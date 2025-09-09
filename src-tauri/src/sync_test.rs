use anyhow::Result;
use crate::sync_fix::{sync_books_in_batches_fixed, sync_students_in_batches_fixed};

#[tauri::command]
pub async fn test_fixed_sync() -> Result<String, String> {
    println!("🧪 Starting sync test with fixed batch sizes...");
    
    match sync_books_in_batches_fixed().await {
        Ok(book_count) => {
            println!("✅ Books sync test: {} books inserted", book_count);
        }
        Err(e) => {
            println!("❌ Books sync test failed: {}", e);
            return Err(format!("Books sync failed: {}", e));
        }
    }
    
    match sync_students_in_batches_fixed().await {
        Ok(student_count) => {
            println!("✅ Students sync test: {} students inserted", student_count);
        }
        Err(e) => {
            println!("❌ Students sync test failed: {}", e);
            return Err(format!("Students sync failed: {}", e));
        }
    }
    
    Ok("✅ Sync test completed successfully".to_string())
}

#[tauri::command]
pub async fn check_supabase_counts() -> Result<String, String> {
    use reqwest;
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let mut results = Vec::new();
    let tables = vec!["books", "students", "borrowings", "book_copies", "fines"];
    
    for table in tables {
        let count_url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/{}?select=count",
            table
        );
        
        match client
            .get(&count_url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<serde_json::Value>().await {
                        Ok(json) => {
                            if let Some(count) = json[0]["count"].as_i64() {
                                results.push(format!("📊 {}: {} records", table, count));
                            } else {
                                results.push(format!("📊 {}: count unavailable", table));
                            }
                        }
                        Err(_) => results.push(format!("📊 {}: parse error", table)),
                    }
                } else {
                    results.push(format!("📊 {}: HTTP {}", table, response.status()));
                }
            }
            Err(_) => results.push(format!("📊 {}: request failed", table)),
        }
    }
    
    Ok(results.join("\n"))
}
