use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::PathBuf;

#[tauri::command]
pub async fn analyze_group_borrowings_table() -> Result<Value, String> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    
    if !db_path.exists() {
        return Err("Database not found".to_string());
    }
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Check if group_borrowings table exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='group_borrowings'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).unwrap_or(false);
    
    if !table_exists {
        return Ok(json!({
            "table_exists": false,
            "error": "group_borrowings table does not exist"
        }));
    }
    
    // Get table schema
    let mut schema_stmt = conn.prepare("PRAGMA table_info(group_borrowings)")
        .map_err(|e| format!("Failed to get table info: {}", e))?;
    
    let schema_rows = schema_stmt.query_map([], |row| {
        Ok(json!({
            "name": row.get::<_, String>(1)?,
            "type": row.get::<_, String>(2)?,
            "not_null": row.get::<_, i32>(3)? == 1,
            "default_value": row.get::<_, Option<String>>(4)?,
            "primary_key": row.get::<_, i32>(5)? == 1
        }))
    }).map_err(|e| format!("Failed to query schema: {}", e))?;
    
    let mut columns = Vec::new();
    for row in schema_rows {
        columns.push(row.map_err(|e| format!("Failed to process schema row: {}", e))?);
    }
    
    // Get sample data
    let mut sample_stmt = conn.prepare("SELECT * FROM group_borrowings LIMIT 5")
        .map_err(|e| format!("Failed to prepare sample query: {}", e))?;
    
    let sample_rows = sample_stmt.query_map([], |row| {
        let mut record = serde_json::Map::new();
        for (i, column) in columns.iter().enumerate() {
            let column_name = column["name"].as_str().unwrap();
            let value: Value = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => Value::Null,
                Ok(rusqlite::types::ValueRef::Integer(i)) => json!(i),
                Ok(rusqlite::types::ValueRef::Real(f)) => json!(f),
                Ok(rusqlite::types::ValueRef::Text(s)) => json!(String::from_utf8_lossy(s)),
                Ok(rusqlite::types::ValueRef::Blob(_)) => json!("[BLOB]"),
                Err(_) => Value::Null,
            };
            record.insert(column_name.to_string(), value);
        }
        Ok(Value::Object(record))
    }).map_err(|e| format!("Failed to query sample data: {}", e))?;
    
    let mut sample_data = Vec::new();
    for row in sample_rows {
        sample_data.push(row.map_err(|e| format!("Failed to process sample row: {}", e))?);
    }
    
    // Count records by status
    let total_count: i32 = conn.query_row("SELECT COUNT(*) FROM group_borrowings", [], |row| row.get(0))
        .unwrap_or(0);
    
    let active_count: i32 = conn.query_row("SELECT COUNT(*) FROM group_borrowings WHERE status = 'active'", [], |row| row.get(0))
        .unwrap_or(0);
    
    let returned_count: i32 = conn.query_row("SELECT COUNT(*) FROM group_borrowings WHERE status = 'returned'", [], |row| row.get(0))
        .unwrap_or(0);
    
    Ok(json!({
        "table_exists": true,
        "schema": columns,
        "sample_data": sample_data,
        "counts": {
            "total": total_count,
            "active": active_count,
            "returned": returned_count
        }
    }))
}

#[tauri::command]
pub async fn test_group_borrowing_return(group_borrowing_id: String) -> Result<Value, String> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Check if the group borrowing exists
    let exists_query = "SELECT id, status, book_id, book_copy_id FROM group_borrowings WHERE id = ?";
    let borrowing_info: Option<(String, String, Option<String>, Option<String>)> = conn.query_row(
        exists_query,
        [&group_borrowing_id],
        |row| Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?
        ))
    ).optional().map_err(|e| format!("Database error: {}", e))?;
    
    match borrowing_info {
        Some((id, status, book_id, book_copy_id)) => {
            Ok(json!({
                "exists": true,
                "id": id,
                "status": status,
                "book_id": book_id,
                "book_copy_id": book_copy_id,
                "can_return": status == "active"
            }))
        },
        None => {
            Ok(json!({
                "exists": false,
                "error": format!("Group borrowing with ID '{}' not found", group_borrowing_id)
            }))
        }
    }
}