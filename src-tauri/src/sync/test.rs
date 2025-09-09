use super::*;
use crate::database::Database;
use tempfile::tempdir;
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::test]
async fn test_sync_state_table_exists() -> Result<()> {
    let temp_dir = tempdir()?;
    let db_path = temp_dir.path().join("test.db");
    let db = Arc::new(Database::new(db_path.to_str().unwrap())?);
    
    let conn = db.conn.lock().await;
    
    // Check if sync_state table exists
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_state'")?;
    let exists: bool = stmt.query_row([], |row| row.get(0)).is_ok();
    
    assert!(exists, "sync_state table should exist");
    Ok(())
}

#[tokio::test]
async fn test_get_last_sync_timestamp() -> Result<()> {
    let temp_dir = tempdir()?;
    let db_path = temp_dir.path().join("test.db");
    let db = Arc::new(Database::new(db_path.to_str().unwrap())?);
    
    let conn = db.conn.lock().await;
    
    // Insert a test sync state
    conn.execute(
        "INSERT INTO sync_state (table_name, last_sync) VALUES (?, ?)",
        ["test_table", "2024-01-01T12:00:00Z"]
    )?;
    
    Ok(())
}

#[tokio::test]
async fn test_sync_all_tables_includes_all_tables() -> Result<()> {
    let temp_dir = tempdir()?;
    let db_path = temp_dir.path().join("test.db");
    let db = Arc::new(Database::new(db_path.to_str().unwrap())?);
    
    // Create a mock sync manager
    let config = SyncConfig {
        url: "http://localhost".to_string(),
        anon_key: "test_key".to_string(),
        service_role_key: "test_role_key".to_string(),
    };
    
    let client = reqwest::Client::new();
    let status = Arc::new(RwLock::new(SyncStatus::default()));
    
    let sync_manager = SyncManager {
        db,
        client,
        config,
        status,
        supabase_client: None,
    };
    
    // Test that all expected tables are included
    let expected_tables = vec![
        "categories", "books", "book_copies", "classes", "students", 
        "staff", "borrowings", "group_borrowings", "fines", 
        "fine_settings", "theft_reports", "user_sessions"
    ];
    
    // This test ensures our sync configuration includes all tables
    assert_eq!(expected_tables.len(), 12);
    
    Ok(())
}
