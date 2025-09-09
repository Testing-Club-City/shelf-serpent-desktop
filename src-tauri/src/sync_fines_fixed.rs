use anyhow::Result;
use serde_json::Value;
use std::path::PathBuf;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;

// CORRECTED Fines sync with proper schema mapping
pub async fn sync_fines_in_batches_fixed() -> Result<u32> {
    println!("🔄 Starting fines sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    sync_table_with_pagination("fines", &pool).await
}

// CORRECTED Fine Settings sync with proper schema mapping
pub async fn sync_fine_settings_in_batches_fixed() -> Result<u32> {
    println!("🔄 Starting fine settings sync...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    sync_fine_settings_table(&pool).await
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
        .head(&count_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .send()
        .await?;
    
    if let Some(content_range) = response.headers().get("content-range") {
        let content_range_str = content_range.to_str().unwrap_or("0-0/0");
        if let Some(total_part) = content_range_str.split('/').nth(1) {
            return Ok(total_part.parse::<u32>().unwrap_or(0));
        }
    }
    
    Ok(0)
}

// Sync fines table
async fn sync_table_with_pagination(table_name: &str, pool: &SqlitePool) -> Result<u32> {
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get total count
    let total_count = get_supabase_count(table_name).await?;
    println!("📊 Total {} in Supabase: {}", table_name, total_count);
    
    if total_count == 0 {
        println!("⚠️ No {} found in Supabase", table_name);
        return Ok(0);
    }
    
    let mut total_synced = 0u32;
    let batch_size = 1000;
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
        let records: Vec<Value> = serde_json::from_str(&body)?;
        
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

// Sync fine_settings table
async fn sync_fine_settings_table(pool: &SqlitePool) -> Result<u32> {
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
    let batch_size = 1000;
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
        let records: Vec<Value> = serde_json::from_str(&body)?;
        
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

// Test function to check current fines data
pub async fn test_fines_sync() -> Result<()> {
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
    
    println!("🚀 Running sync at {}", chrono::Utc::now());
    println!("============================================================");
    println!("ℹ️  To run the actual sync, use:");
    println!("   cargo run --bin debug_fines_sync");
    println!("   or call sync_fines_in_batches_fixed() from your Rust code");
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_fines_sync_function() {
        let result = test_fines_sync().await;
        assert!(result.is_ok());
    }
}
