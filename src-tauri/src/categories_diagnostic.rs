use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;
use std::collections::HashMap;

/// Diagnostic tool to analyze categories data and identify conflicts
pub async fn diagnose_categories_conflicts() -> Result<()> {
    println!("🔍 Starting Categories Conflict Diagnosis...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Analyze local categories
    println!("\n📊 LOCAL DATABASE ANALYSIS:");
    
    let local_categories = sqlx::query("SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name")
        .fetch_all(&pool)
        .await?;
    
    println!("📋 Local categories count: {}", local_categories.len());
    
    // Check for duplicate names
    let mut name_counts: HashMap<String, Vec<String>> = HashMap::new();
    
    for row in &local_categories {
        let id: String = row.get("id");
        let name: String = row.get("name");
        
        name_counts.entry(name.clone()).or_insert_with(Vec::new).push(id);
    }
    
    let duplicates: Vec<_> = name_counts.iter()
        .filter(|(_, ids)| ids.len() > 1)
        .collect();
    
    if !duplicates.is_empty() {
        println!("⚠️ Found {} duplicate category names in local database:", duplicates.len());
        for (name, ids) in duplicates {
            println!("   '{}' -> IDs: {:?}", name, ids);
        }
    } else {
        println!("✅ No duplicate names found in local database");
    }
    
    // Analyze remote categories
    println!("\n📊 REMOTE DATABASE ANALYSIS:");
    
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/categories?select=*&order=name.asc";
    
    let response = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .send()
        .await?;
    
    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let remote_categories = json.as_array().unwrap_or(&empty_vec);
        
        println!("📋 Remote categories count: {}", remote_categories.len());
        
        // Check for duplicate names in remote
        let mut remote_name_counts: HashMap<String, Vec<String>> = HashMap::new();
        
        for category in remote_categories {
            let id = category["id"].as_str().unwrap_or("").to_string();
            let name = category["name"].as_str().unwrap_or("").to_string();
            
            remote_name_counts.entry(name.clone()).or_insert_with(Vec::new).push(id);
        }
        
        let remote_duplicates: Vec<_> = remote_name_counts.iter()
            .filter(|(_, ids)| ids.len() > 1)
            .collect();
        
        if !remote_duplicates.is_empty() {
            println!("⚠️ Found {} duplicate category names in remote database:", remote_duplicates.len());
            for (name, ids) in remote_duplicates {
                println!("   '{}' -> IDs: {:?}", name, ids);
            }
        } else {
            println!("✅ No duplicate names found in remote database");
        }
        
        // Compare local vs remote
        println!("\n🔄 COMPARISON ANALYSIS:");
        
        let local_names: std::collections::HashSet<String> = name_counts.keys().cloned().collect();
        let remote_names: std::collections::HashSet<String> = remote_name_counts.keys().cloned().collect();
        
        let only_local: Vec<_> = local_names.difference(&remote_names).collect();
        let only_remote: Vec<_> = remote_names.difference(&local_names).collect();
        let common: Vec<_> = local_names.intersection(&remote_names).collect();
        
        println!("📊 Categories only in local: {} ({:?})", only_local.len(), only_local);
        println!("📊 Categories only in remote: {} ({:?})", only_remote.len(), only_remote);
        println!("📊 Categories in both: {}", common.len());
        
        // Check for ID conflicts for same names
        println!("\n🆔 ID CONFLICT ANALYSIS:");
        let mut id_conflicts = 0;
        
        for name in &common {
            let local_ids = name_counts.get(*name).unwrap();
            let remote_ids = remote_name_counts.get(*name).unwrap();
            
            if local_ids != remote_ids {
                id_conflicts += 1;
                println!("⚠️ ID conflict for '{}': Local={:?}, Remote={:?}", name, local_ids, remote_ids);
            }
        }
        
        if id_conflicts == 0 {
            println!("✅ No ID conflicts found for common category names");
        } else {
            println!("❌ Found {} ID conflicts", id_conflicts);
        }
        
    } else {
        println!("❌ Failed to fetch remote categories: {}", response.status());
    }
    
    pool.close().await;
    println!("\n🎉 Diagnosis completed!");
    
    Ok(())
}

/// Clean up duplicate categories by keeping the most recent one
pub async fn cleanup_duplicate_categories() -> Result<u32> {
    println!("🧹 Starting Categories Cleanup...");
    
    // Set up database path
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    // Connect to local database
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    // Find duplicate names
    let duplicates = sqlx::query(
        r#"
        SELECT name, COUNT(*) as count
        FROM categories 
        GROUP BY name 
        HAVING COUNT(*) > 1
        "#
    )
    .fetch_all(&pool)
    .await?;
    
    if duplicates.is_empty() {
        println!("✅ No duplicate categories found");
        pool.close().await;
        return Ok(0);
    }
    
    println!("🔍 Found {} category names with duplicates", duplicates.len());
    
    let mut cleaned = 0;
    
    for duplicate_row in duplicates {
        let name: String = duplicate_row.get("name");
        let count: i64 = duplicate_row.get("count");
        
        println!("🧹 Cleaning up '{}' ({} duplicates)", name, count);
        
        // Get all records with this name, ordered by updated_at DESC
        let records = sqlx::query(
            "SELECT id, created_at, updated_at FROM categories WHERE name = ? ORDER BY updated_at DESC, created_at DESC"
        )
        .bind(&name)
        .fetch_all(&pool)
        .await?;
        
        if records.len() > 1 {
            // Keep the first (most recent) record, delete the rest
            let keep_id: String = records[0].get("id");
            
            for record in records.iter().skip(1) {
                let delete_id: String = record.get("id");
                
                match sqlx::query("DELETE FROM categories WHERE id = ?")
                    .bind(&delete_id)
                    .execute(&pool)
                    .await
                {
                    Ok(_) => {
                        cleaned += 1;
                        println!("   ✅ Deleted duplicate ID: {}", delete_id);
                    },
                    Err(e) => {
                        println!("   ❌ Failed to delete ID {}: {}", delete_id, e);
                    }
                }
            }
            
            println!("   ✅ Kept most recent ID: {}", keep_id);
        }
    }
    
    pool.close().await;
    println!("🎉 Cleanup completed: {} duplicate records removed", cleaned);
    
    Ok(cleaned)
}
