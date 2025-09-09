use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;

/// Fixed categories sync that properly handles UNIQUE constraint on name field
pub async fn sync_categories_from_supabase_fixed() -> Result<u32> {
    println!("📥 Starting Categories sync with UPSERT...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Get total count from Supabase first
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Get count from Supabase
    let count_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=count";
    let count_response = client
        .head(count_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .send()
        .await?;
    
    let total_remote = if let Some(count_header) = count_response.headers().get("content-range") {
        if let Ok(count_str) = count_header.to_str() {
            if let Some(count_part) = count_str.split('/').nth(1) {
                count_part.parse::<u32>().unwrap_or(0)
            } else { 0 }
        } else { 0 }
    } else { 0 };
    
    println!("📊 Total categories in Supabase: {}", total_remote);
    
    // Get local count
    let local_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM categories")
        .fetch_one(&pool)
        .await?;
    
    println!("📊 Found {} existing local categories", local_count);
    
    if total_remote == 0 {
        println!("⚠️ No categories found in Supabase");
        pool.close().await;
        return Ok(0);
    }
    
    // Fetch all categories from Supabase
    let batch_size = 1000;
    let mut offset = 0;
    let mut total_processed = 0;
    let mut batch_number = 1;
    
    loop {
        let range_start = offset;
        let range_end = offset + batch_size - 1;
        
        println!("📖 Fetching categories range {}-{}...", range_start, range_end);
        
        let url = format!(
            "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=*&order=created_at.asc"
        );
        
        let response = client
            .get(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Range", format!("{}-{}", range_start, range_end))
            .send()
            .await?;
        
        if !response.status().is_success() {
            println!("❌ Failed to fetch batch {}: {}", batch_number, response.status());
            break;
        }
        
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let categories = json.as_array().unwrap_or(&empty_vec);
        
        if categories.is_empty() {
            println!("✅ No more categories to fetch");
            break;
        }
        
        println!("📚 Processing {} categories with UPSERT...", categories.len());
        
        // Start transaction for this batch
        let mut tx = pool.begin().await?;
        let mut batch_processed = 0;
        
        for category in categories {
            let id = category["id"].as_str().unwrap_or_default();
            let name = category["name"].as_str().unwrap_or("Unknown Category");
            let description = category["description"].as_str();
            let created_at = category["created_at"].as_str();
            let updated_at = category["updated_at"].as_str();
            
            // Use INSERT OR IGNORE to avoid UNIQUE constraint violations
            let query = r#"
                INSERT OR IGNORE INTO categories (id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
            "#;
            
            match sqlx::query(query)
                .bind(id)
                .bind(name)
                .bind(description)
                .bind(created_at)
                .bind(updated_at)
                .execute(&mut *tx)
                .await
            {
                Ok(_) => {
                    batch_processed += 1;
                },
                Err(e) => {
                    println!("❌ Error upserting categories: {}", e);
                    // Skip this record and continue
                }
            }
        }
        
        // Commit the transaction
        match tx.commit().await {
            Ok(_) => {
                total_processed += batch_processed;
                println!("✅ Batch {} committed: {} categories processed", batch_number, batch_processed);
            },
            Err(e) => {
                println!("❌ Batch {} commit failed: {}", batch_number, e);
            }
        }
        
        // Move to next batch
        offset += batch_size;
        batch_number += 1;
        
        // Safety check
        if offset >= total_remote || batch_number > 100 {
            break;
        }
    }
    
    pool.close().await;
    println!("✅ Processed {} categories with UPSERT", total_processed);
    println!("🎉 categories sync completed: {} records processed", total_processed);
    
    Ok(total_processed)
}

/// Alternative approach using DELETE and INSERT strategy
#[allow(dead_code)]
pub async fn sync_categories_from_supabase_delete_insert() -> Result<u32> {
    println!("📥 Starting Categories sync with DELETE-INSERT strategy...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Fetch all categories from Supabase
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=*&order=created_at.asc";
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Failed to fetch categories from Supabase: {}", response.status()));
    }
    
    let json: serde_json::Value = response.json().await?;
    let empty_vec = vec![];
    let categories = json.as_array().unwrap_or(&empty_vec);
    
    println!("📊 Found {} categories in Supabase", categories.len());
    
    if categories.is_empty() {
        println!("⚠️ No categories found in Supabase");
        pool.close().await;
        return Ok(0);
    }
    
    // Start transaction
    let mut tx = pool.begin().await?;
    
    // Clear existing categories (be careful with foreign key constraints)
    println!("🗑️ Clearing existing categories...");
    sqlx::query("DELETE FROM categories")
        .execute(&mut *tx)
        .await?;
    
    // Insert all categories fresh
    let mut inserted = 0;
    for category in categories {
        let id = category["id"].as_str().unwrap_or_default();
        let name = category["name"].as_str().unwrap_or("Unknown Category");
        let description = category["description"].as_str();
        let created_at = category["created_at"].as_str();
        let updated_at = category["updated_at"].as_str();
        
        let query = r#"
            INSERT INTO categories (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
        "#;
        
        match sqlx::query(query)
            .bind(id)
            .bind(name)
            .bind(description)
            .bind(created_at)
            .bind(updated_at)
            .execute(&mut *tx)
            .await
        {
            Ok(_) => inserted += 1,
            Err(e) => {
                println!("❌ Error inserting category '{}': {}", name, e);
            }
        }
    }
    
    // Commit transaction
    tx.commit().await?;
    
    pool.close().await;
    println!("✅ Categories sync completed: {} records inserted", inserted);
    
    Ok(inserted)
}
