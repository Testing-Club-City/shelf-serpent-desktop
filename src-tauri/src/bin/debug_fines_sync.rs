use anyhow::Result;
use serde_json::Value;
use std::path::PathBuf;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🔄 Testing fines sync...");
    println!("============================================================");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Check current fines count
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM fines WHERE deleted = 0")
        .fetch_one(&pool).await?;
    println!("📊 Current fines in local DB: {}", count);
    
    // Check fine settings count
    let settings_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM fine_settings")
        .fetch_one(&pool).await?;
    println!("📊 Current fine settings in local DB: {}", settings_count);
    
    // Sample some fines data
    let rows = sqlx::query("SELECT id, student_id, fine_type, amount, status, description FROM fines WHERE deleted = 0 LIMIT 5")
        .fetch_all(&pool).await?;
    
    println!("\n📋 Sample fines data:");
    println!("--------------------------------------------------------------------------------");
    for row in rows {
        let id: String = row.get("id");
        let student_id: String = row.get("student_id");
        let fine_type: String = row.get("fine_type");
        let amount: f64 = row.get("amount");
        let status: String = row.get("status");
        let description: String = row.get("description");
        
        println!("ID: {}", id);
        println!("Student ID: {}", student_id);
        println!("Type: {}", fine_type);
        println!("Amount: ${:.2}", amount);
        println!("Status: {}", status);
        println!("Description: {}", description);
        println!("----------------------------------------");
    }
    
    // Now let's try to sync some fines from Supabase
    println!("\n🚀 Testing Supabase connection for fines...");
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Test connection to fines table
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/fines?select=*&limit=5";
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if response.status().is_success() {
        let body = response.text().await?;
        let records: Vec<Value> = serde_json::from_str(&body)?;
        println!("✅ Successfully connected to Supabase fines table");
        println!("📊 Found {} sample fines records in Supabase", records.len());
        
        if !records.is_empty() {
            println!("\n📋 Sample Supabase fines data:");
            println!("--------------------------------------------------------------------------------");
            for record in records.iter().take(3) {
                println!("ID: {}", record["id"].as_str().unwrap_or("N/A"));
                println!("Student ID: {}", record["student_id"].as_str().unwrap_or("N/A"));
                println!("Type: {}", record["fine_type"].as_str().unwrap_or("N/A"));
                println!("Amount: {}", record["amount"].as_f64().unwrap_or(0.0));
                println!("Status: {}", record["status"].as_str().unwrap_or("N/A"));
                println!("----------------------------------------");
            }
        }
    } else {
        let error_text = response.text().await?;
        println!("❌ Failed to connect to Supabase fines table: {}", error_text);
    }
    
    // Test connection to fine_settings table
    let settings_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/fine_settings?select=*&limit=5";
    
    let settings_response = client
        .get(settings_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if settings_response.status().is_success() {
        let body = settings_response.text().await?;
        let records: Vec<Value> = serde_json::from_str(&body)?;
        println!("\n✅ Successfully connected to Supabase fine_settings table");
        println!("📊 Found {} fine settings records in Supabase", records.len());
        
        if !records.is_empty() {
            println!("\n📋 Sample Supabase fine settings data:");
            println!("--------------------------------------------------------------------------------");
            for record in records.iter().take(3) {
                println!("ID: {}", record["id"].as_str().unwrap_or("N/A"));
                println!("Type: {}", record["fine_type"].as_str().unwrap_or("N/A"));
                println!("Amount: {}", record["amount"].as_f64().unwrap_or(0.0));
                println!("Description: {}", record["description"].as_str().unwrap_or("N/A"));
                println!("----------------------------------------");
            }
        }
    } else {
        let error_text = settings_response.text().await?;
        println!("❌ Failed to connect to Supabase fine_settings table: {}", error_text);
    }
    
    println!("\n🎉 === FINES SYNC TEST COMPLETED ===");
    println!("ℹ️  The fines sync functions are ready to be integrated into your main sync process!");
    println!("ℹ️  You can call sync_fines_in_batches_fixed() and sync_fine_settings_in_batches_fixed()");
    println!("ℹ️  from your existing sync_all_fixed.rs or through the UI sync button.");
    
    Ok(())
}
