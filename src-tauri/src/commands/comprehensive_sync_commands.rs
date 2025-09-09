use tauri::State;
use serde_json::Value;
use crate::comprehensive_sync::{run_comprehensive_sync, SyncSummary};

/// Command to run comprehensive sync of all tables
#[tauri::command]
pub async fn sync_all_settings() -> Result<Value, String> {
    println!("🚀 Starting comprehensive sync of all library settings and data...");
    
    match run_comprehensive_sync().await {
        Ok(summary) => {
            let result = serde_json::json!({
                "success": true,
                "total_records": summary.total_records(),
                "successful_tables": summary.successful_tables(),
                "failed_tables": summary.failed_tables(),
                "duration_seconds": summary.total_duration.as_secs(),
                "results": summary.results.iter().map(|(table, result)| {
                    match result {
                        Ok(count) => serde_json::json!({
                            "table": table,
                            "status": "success",
                            "records": count
                        }),
                        Err(error) => serde_json::json!({
                            "table": table,
                            "status": "error",
                            "error": error
                        })
                    }
                }).collect::<Vec<_>>(),
                "errors": summary.errors
            });
            
            println!("✅ Comprehensive sync completed successfully!");
            println!("📊 Total records synced: {}", summary.total_records());
            println!("⏱️  Duration: {:?}", summary.total_duration);
            
            Ok(result)
        }
        Err(e) => {
            let error_msg = format!("Comprehensive sync failed: {}", e);
            println!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}

/// Command to sync specific table
#[tauri::command]
pub async fn sync_specific_table(table_name: String) -> Result<Value, String> {
    println!("🔄 Starting sync for table: {}", table_name);
    
    let sync = crate::comprehensive_sync::ComprehensiveSync::new().await
        .map_err(|e| format!("Failed to initialize sync: {}", e))?;
    
    let batch_size = match table_name.as_str() {
        "book_copies" => 5000,
        "borrowings" => 3000,
        "students" => 2000,
        "notifications" => 2000,
        "fines" => 2000,
        _ => 1000,
    };
    
    match sync.sync_table(&table_name, batch_size).await {
        Ok(count) => {
            let result = serde_json::json!({
                "success": true,
                "table": table_name,
                "records_synced": count
            });
            
            println!("✅ {} sync completed: {} records", table_name, count);
            Ok(result)
        }
        Err(e) => {
            let error_msg = format!("Failed to sync {}: {}", table_name, e);
            println!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}

/// Command to get sync status and statistics
#[tauri::command]
pub async fn get_sync_status() -> Result<Value, String> {
    println!("📊 Getting sync status and database statistics...");
    
    let sync = crate::comprehensive_sync::ComprehensiveSync::new().await
        .map_err(|e| format!("Failed to initialize sync: {}", e))?;
    
    // Get counts for each table
    let tables = vec![
        "categories", "classes", "books", "students", "staff", 
        "book_copies", "borrowings", "fines", "fine_settings",
        "group_borrowings", "theft_reports", "notifications", "profiles"
    ];
    
    let mut table_counts = std::collections::HashMap::new();
    
    for table in &tables {
        let query = format!("SELECT COUNT(*) FROM {}", table);
        match sqlx::query_scalar::<_, i64>(&query)
            .fetch_one(&sync.pool)
            .await 
        {
            Ok(count) => {
                table_counts.insert(table.to_string(), count);
            }
            Err(_) => {
                table_counts.insert(table.to_string(), 0);
            }
        }
    }
    
    let result = serde_json::json!({
        "success": true,
        "table_counts": table_counts,
        "total_records": table_counts.values().sum::<i64>(),
        "available_tables": tables,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    println!("✅ Sync status retrieved successfully");
    Ok(result)
}

/// Command to clear all local data (for fresh sync)
#[tauri::command]
pub async fn clear_all_local_data() -> Result<Value, String> {
    println!("🗑️  Clearing all local data for fresh sync...");
    
    let sync = crate::comprehensive_sync::ComprehensiveSync::new().await
        .map_err(|e| format!("Failed to initialize sync: {}", e))?;
    
    let tables = vec![
        "theft_reports", "notifications", "fines", "group_borrowings",
        "borrowings", "book_copies", "books", "students", "staff",
        "profiles", "fine_settings", "categories", "classes"
    ];
    
    let mut cleared_tables = Vec::new();
    let mut errors = Vec::new();
    
    for table in &tables {
        let query = format!("DELETE FROM {}", table);
        match sqlx::query(&query).execute(&sync.pool).await {
            Ok(result) => {
                let rows_affected = result.rows_affected();
                cleared_tables.push(serde_json::json!({
                    "table": table,
                    "rows_deleted": rows_affected
                }));
                println!("🗑️  Cleared {}: {} rows", table, rows_affected);
            }
            Err(e) => {
                let error_msg = format!("Failed to clear {}: {}", table, e);
                errors.push(error_msg.clone());
                println!("❌ {}", error_msg);
            }
        }
    }
    
    let result = serde_json::json!({
        "success": errors.is_empty(),
        "cleared_tables": cleared_tables,
        "errors": errors,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    if errors.is_empty() {
        println!("✅ All local data cleared successfully");
    } else {
        println!("⚠️  Some tables could not be cleared");
    }
    
    Ok(result)
}

/// Command to validate database integrity
#[tauri::command]
pub async fn validate_database_integrity() -> Result<Value, String> {
    println!("🔍 Validating database integrity...");
    
    let sync = crate::comprehensive_sync::ComprehensiveSync::new().await
        .map_err(|e| format!("Failed to initialize sync: {}", e))?;
    
    let mut validation_results = Vec::new();
    
    // Check for orphaned records
    let checks = vec![
        ("books with invalid category_id", 
         "SELECT COUNT(*) FROM books WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories)"),
        ("students with invalid class_id", 
         "SELECT COUNT(*) FROM students WHERE class_id IS NOT NULL AND class_id NOT IN (SELECT id FROM classes)"),
        ("book_copies with invalid book_id", 
         "SELECT COUNT(*) FROM book_copies WHERE book_id IS NOT NULL AND book_id NOT IN (SELECT id FROM books)"),
        ("borrowings with invalid student_id", 
         "SELECT COUNT(*) FROM borrowings WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM students)"),
        ("borrowings with invalid book_id", 
         "SELECT COUNT(*) FROM borrowings WHERE book_id IS NOT NULL AND book_id NOT IN (SELECT id FROM books)"),
        ("fines with invalid student_id", 
         "SELECT COUNT(*) FROM fines WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM students)"),
    ];
    
    for (check_name, query) in checks {
        match sqlx::query_scalar::<_, i64>(query)
            .fetch_one(&sync.pool)
            .await 
        {
            Ok(count) => {
                validation_results.push(serde_json::json!({
                    "check": check_name,
                    "status": if count == 0 { "pass" } else { "fail" },
                    "orphaned_records": count
                }));
            }
            Err(e) => {
                validation_results.push(serde_json::json!({
                    "check": check_name,
                    "status": "error",
                    "error": e.to_string()
                }));
            }
        }
    }
    
    let failed_checks = validation_results.iter()
        .filter(|r| r["status"] == "fail" || r["status"] == "error")
        .count();
    
    let result = serde_json::json!({
        "success": true,
        "overall_status": if failed_checks == 0 { "healthy" } else { "issues_found" },
        "total_checks": validation_results.len(),
        "failed_checks": failed_checks,
        "validation_results": validation_results,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    println!("✅ Database integrity validation completed");
    println!("📊 {}/{} checks passed", validation_results.len() - failed_checks, validation_results.len());
    
    Ok(result)
}
