use crate::database::DatabaseManager;
use crate::professional_sync::professional_pull_all_database;
use serde_json::{Value, json};
use tauri::State;
use std::sync::Arc;
use tracing::info;

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
pub async fn get_local_data_stats() -> Result<crate::database::LibraryStats, String> {
    info!("Getting local data statistics...");
    
    let db = DatabaseManager::new().await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    let stats = db.get_library_stats().await
        .map_err(|e| format!("Failed to get library stats: {}", e))?;
    
    info!("Library stats retrieved: {:?}", stats);
    Ok(stats)
}

#[tauri::command]
pub async fn professional_pull_all_database() -> Result<String, String> {
    crate::professional_sync::professional_pull_all_database()
        .await
        .map_err(|e| format!("Professional sync failed: {}", e))
}
