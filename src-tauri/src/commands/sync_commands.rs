use crate::database::{DatabaseManager, LibraryStats};
use crate::sync_all_fixed::pull_all_database_fixed;
use serde_json::{Value, json};
use tauri::State;
use std::sync::Arc;
use tracing::{info, error};

pub type DatabaseState = Arc<DatabaseManager>;

#[tauri::command]
pub async fn clear_local_database() -> Result<String, String> {
    info!("Clearing local database...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    
    // Remove the database file
    if std::fs::remove_file(&db_path).is_ok() {
        info!("Database file removed successfully");
        // Recreate the database
        let db = DatabaseManager::new().await
            .map_err(|e| format!("Failed to recreate database: {}", e))?;
        
        Ok("Local database cleared and recreated successfully".to_string())
    } else {
        Err("Failed to remove database file".to_string())
    }
}

#[tauri::command]
pub async fn get_local_data_stats() -> Result<LibraryStats, String> {
    info!("Getting local data statistics...");
    
    let db = DatabaseManager::new().await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    let stats = db.get_library_stats().await
        .map_err(|e| format!("Failed to get library stats: {}", e))?;
    
    info!("Library stats retrieved: {:?}", stats);
    Ok(stats)
}

#[tauri::command]
pub async fn comprehensive_sync_from_supabase() -> Result<Value, String> {
    info!("Starting comprehensive database sync from Supabase...");
    
    let start_time = std::time::Instant::now();
    
    match pull_all_database_fixed().await {
        Ok(_) => {
            let duration = start_time.elapsed();
            info!("Comprehensive sync completed in {:?}", duration);
            
            // Get updated stats
            let db = DatabaseManager::new().await
                .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
            let stats = db.get_library_stats().await
                .map_err(|e| format!("Failed to get library stats: {}", e))?;
            
            Ok(json!({
                "status": "success",
                "message": "Database sync completed successfully",
                "duration_ms": duration.as_millis(),
                "stats": {
                    "total_books": stats.total_books,
                    "total_students": stats.total_students,
                    "available_books": stats.available_books,
                    "total_borrowings": stats.total_borrowings,
                    "total_fines": stats.total_fines
                }
            }))
        }
        Err(e) => {
            error!("Comprehensive sync failed: {}", e);
            Err(format!("Sync failed: {}", e))
        }
    }
}
