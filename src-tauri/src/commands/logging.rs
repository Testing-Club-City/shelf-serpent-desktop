use crate::logging::{ActivityLogger, ActivityLogEntry, LogLevel};
use crate::database::DatabaseManager;
use serde_json::Value;
use std::sync::Arc;
use tauri::State;
use tracing::info;

pub type DatabaseState = Arc<DatabaseManager>;

/// Initialize activity logger (legacy - now using database)
#[tauri::command]
pub async fn init_activity_logger(
    log_dir: String,
) -> Result<String, String> {
    // For backward compatibility, just return success
    // Activity logging now uses database directly
    info!("Activity logger initialized (database-based)");
    Ok("Activity logger initialized (database-based)".to_string())
}

/// Log an activity entry
#[tauri::command]
pub async fn log_activity_entry(
    entry_data: Value,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    let entry: ActivityLogEntry = serde_json::from_value(entry_data)
        .map_err(|e| format!("Failed to parse activity log entry: {}", e))?;
    
    db.insert_activity_log(&entry)
        .await
        .map_err(|e| format!("Failed to insert activity log: {}", e))?;
    
    Ok(())
}

/// Log a simple activity with common fields
#[tauri::command]
pub async fn log_simple_activity(
    level: String,
    category: String,
    action: String,
    user_id: Option<String>,
    user_email: Option<String>,
    resource_type: Option<String>,
    resource_id: Option<String>,
    details: Option<Value>,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    let log_level = match level.to_lowercase().as_str() {
        "trace" => LogLevel::Trace,
        "debug" => LogLevel::Debug,
        "info" => LogLevel::Info,
        "warn" | "warning" => LogLevel::Warning,
        "error" => LogLevel::Error,
        "critical" => LogLevel::Critical,
        _ => LogLevel::Info,
    };

    let mut entry = ActivityLogEntry::new(log_level, category, action);

    if let (Some(uid), ue) = (user_id, user_email) {
        entry = entry.with_user(uid, ue);
    }

    if let (Some(rt), ri) = (resource_type, resource_id) {
        entry = entry.with_resource(rt, ri);
    }

    if let Some(details) = details {
        entry = entry.with_details(details);
    }

    db.insert_activity_log(&entry)
        .await
        .map_err(|e| format!("Failed to insert activity log: {}", e))?;
    
    Ok(())
}

/// Get recent activity logs
#[tauri::command]
pub async fn get_activity_logs(
    limit: Option<usize>,
    db: State<'_, DatabaseState>,
) -> Result<Vec<ActivityLogEntry>, String> {
    db.get_activity_logs(limit)
        .await
        .map_err(|e| format!("Failed to read activity logs: {}", e))
}

/// Get activity log statistics
#[tauri::command]
pub async fn get_activity_log_stats(
    db: State<'_, DatabaseState>,
) -> Result<Value, String> {
    db.get_activity_log_stats()
        .await
        .map_err(|e| format!("Failed to get log stats: {}", e))
}

/// Export activity logs to a specific file
#[tauri::command]
pub async fn export_activity_logs(
    export_path: String,
    limit: Option<usize>,
    db: State<'_, DatabaseState>,
) -> Result<String, String> {
    let logs = db.get_activity_logs(limit)
        .await
        .map_err(|e| format!("Failed to read logs: {}", e))?;

    let export_data = serde_json::json!({
        "exported_at": chrono::Utc::now(),
        "total_entries": logs.len(),
        "logs": logs
    });

    std::fs::write(&export_path, serde_json::to_string_pretty(&export_data).unwrap())
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(format!("Exported {} log entries to {}", logs.len(), export_path))
}

/// Clear activity logs (with backup)
#[tauri::command]
pub async fn clear_activity_logs(
    create_backup: bool,
    db: State<'_, DatabaseState>,
) -> Result<String, String> {
    db.clear_activity_logs(create_backup)
        .await
        .map_err(|e| format!("Failed to clear activity logs: {}", e))
}
