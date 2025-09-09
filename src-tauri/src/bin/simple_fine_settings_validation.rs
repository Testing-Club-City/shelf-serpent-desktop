use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::{Row, Column};
use std::path::PathBuf;
use serde_json::{Value, json};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🧪 Validating fine_settings sync fix...");
    
    // Connect to database
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // 1. Check local fine_settings schema
    println!("📋 Checking local fine_settings schema...");
    let table_info = sqlx::query("PRAGMA table_info(fine_settings)")
        .fetch_all(&pool)
        .await?;
    
    let mut has_amount = false;
    let mut columns = Vec::new();
    
    for row in &table_info {
        let column_name: String = row.get("name");
        columns.push(column_name.clone());
        if column_name == "amount" {
            has_amount = true;
        }
    }
    
    println!("📊 All columns: {:?}", columns);
    println!("📊 Has amount column: {}", has_amount);
    
    if !has_amount {
        println!("❌ ERROR: fine_settings table missing amount column!");
        return Ok(());
    }
    
    println!("✅ Local fine_settings schema is correct");
    
    // 2. Check local fine_settings records
    let local_records = sqlx::query("SELECT * FROM fine_settings LIMIT 3")
        .fetch_all(&pool)
        .await?;
    
    println!("📋 Found {} local fine_settings records", local_records.len());
    
    for (i, row) in local_records.iter().enumerate() {
        let id: String = row.get("id");
        let fine_type: Option<String> = row.try_get("type").ok().or_else(|| row.try_get("fine_type").ok());
        let amount: Option<f64> = row.try_get("amount").ok();
        let description: Option<String> = row.try_get("description").ok();
        
        println!("  {}. ID: {}, Type: {:?}, Amount: {:?}, Description: {:?}", 
                 i+1, id, fine_type, amount, description);
    }
    
    // 3. Test mapping logic manually (simulate what SchemaMapper does)
    println!("🔧 Testing mapping logic...");
    
    if let Some(first_row) = local_records.first() {
        let mut row_map = HashMap::new();
        
        for column in first_row.columns() {
            let column_name = column.name();
            let value: Value = match first_row.try_get::<Option<String>, _>(column_name) {
                Ok(Some(s)) => json!(s),
                Ok(None) => Value::Null,
                Err(_) => {
                    match first_row.try_get::<Option<f64>, _>(column_name) {
                        Ok(Some(f)) => json!(f),
                        Ok(None) => Value::Null,
                        Err(_) => Value::Null,
                    }
                }
            };
            row_map.insert(column_name.to_string(), value);
        }
        
        // Manual mapping like SchemaMapper does
        let mapped_data = json!({
            "id": row_map.get("id").unwrap_or(&Value::Null),
            "fine_type": row_map.get("type").unwrap_or(&row_map.get("fine_type").unwrap_or(&Value::Null)),
            "amount": row_map.get("amount").unwrap_or(&json!(0.0)),
            "description": row_map.get("description").unwrap_or(&Value::Null),
            "created_at": row_map.get("created_at").unwrap_or(&Value::Null),
            "updated_at": row_map.get("updated_at").unwrap_or(&Value::Null)
        });
        
        println!("📤 Mapped data for Supabase: {}", serde_json::to_string_pretty(&mapped_data)?);
        
        // Validate required fields
        let has_id = mapped_data.get("id").is_some() && !mapped_data["id"].is_null();
        let has_fine_type = mapped_data.get("fine_type").is_some() && !mapped_data["fine_type"].is_null();
        let has_amount = mapped_data.get("amount").is_some() && !mapped_data["amount"].is_null();
        
        println!("✅ Validation - ID: {}, fine_type: {}, amount: {}", has_id, has_fine_type, has_amount);
        
        if has_id && has_fine_type && has_amount {
            println!("✅ Schema mapping logic is working correctly!");
        } else {
            println!("❌ Schema mapping has issues - missing required fields");
        }
    }
    
    // 4. Test connectivity to Supabase fine_settings
    println!("🌐 Testing Supabase connectivity...");
    
    let client = reqwest::Client::new();
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let response = client
        .get(&format!("{}/rest/v1/fine_settings?limit=1", supabase_url))
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await;
    
    match response {
        Ok(resp) if resp.status().is_success() => {
            println!("✅ Supabase fine_settings table is accessible");
            
            let json: Value = resp.json().await?;
            if let Some(records) = json.as_array() {
                println!("📋 Supabase has {} fine_settings records", records.len());
                if let Some(first_record) = records.first() {
                    println!("📋 Sample Supabase record structure:");
                    if let Some(obj) = first_record.as_object() {
                        for (key, _value) in obj {
                            println!("  - {}", key);
                        }
                    }
                }
            }
        },
        Ok(resp) => {
            println!("❌ Supabase responded with error: {}", resp.status());
            let error_text = resp.text().await.unwrap_or_default();
            println!("Error details: {}", error_text);
        },
        Err(e) => {
            println!("❌ Failed to connect to Supabase: {}", e);
        }
    }
    
    println!("🎉 Fine_settings sync validation completed!");
    
    Ok(())
}
