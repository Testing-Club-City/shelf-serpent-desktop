use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_windows_safe_db_path() -> Result<PathBuf, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("Failed to get Windows AppData directory")?
        .join("library-management-system");
    
    // Ensure directory exists with proper permissions
    if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        return Err(format!("Failed to create app directory: {}", e));
    }
    
    let db_path = app_data_dir.join("library.db");
    
    // Validate path doesn't contain problematic characters
    if let Some(path_str) = db_path.to_str() {
        if path_str.contains("'") || path_str.contains("\"") {
            return Err("Database path contains invalid characters".to_string());
        }
    }
    
    Ok(db_path)
}

pub fn configure_windows_sqlite(conn: &Connection) -> Result<()> {
    // Windows-specific SQLite configuration
    conn.execute_batch("
        PRAGMA journal_mode = DELETE;
        PRAGMA synchronous = FULL;
        PRAGMA cache_size = -32000;
        PRAGMA foreign_keys = ON;
        PRAGMA temp_store = memory;
        PRAGMA busy_timeout = 60000;
        PRAGMA locking_mode = NORMAL;
    ")?;
    
    Ok(())
}

pub fn is_windows() -> bool {
    cfg!(target_os = "windows")
}
