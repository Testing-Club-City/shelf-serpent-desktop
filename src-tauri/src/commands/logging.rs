use crate::logging::{ActivityLogger, ActivityLogEntry, LogLevel};
use serde_json::Value;
use std::sync::Arc;
use tauri::State;
use tracing::info;

pub type ActivityLoggerState = Arc<ActivityLogger>;

/// Initialize activity logger
#[tauri::command]
pub async fn init_activity_logger(
    log_dir: String,
) -> Result<String, String> {
    let log_path = std::path::PathBuf::from(log_dir);
    
    match ActivityLogger::new(log_path) {
        Ok(_) => {
            info!("Activity logger initialized successfully");
            Ok("Activity logger initialized".to_string())
        },
        Err(e) => Err(format!("Failed to initialize activity logger: {}", e))
    }
}

/// Log an activity entry
#[tauri::command]
pub async fn log_activity_entry(
    entry_data: Value,
    logger: State<'_, ActivityLoggerState>,
) -> Result<(), String> {
    let entry: ActivityLogEntry = serde_json::from_value(entry_data)
        .map_err(|e| format!("Failed to parse activity log entry: {}", e))?;
    
    logger.log(&entry);
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
    logger: State<'_, ActivityLoggerState>,
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

    logger.log(&entry);
    Ok(())
}

/// Get recent activity logs
#[tauri::command]
pub async fn get_activity_logs(
    limit: Option<usize>,
    logger: State<'_, ActivityLoggerState>,
) -> Result<Vec<ActivityLogEntry>, String> {
    logger.read_logs(limit)
        .map_err(|e| format!("Failed to read activity logs: {}", e))
}

/// Get activity log statistics
#[tauri::command]
pub async fn get_activity_log_stats(
    logger: State<'_, ActivityLoggerState>,
) -> Result<Value, String> {
    logger.get_log_stats()
        .map_err(|e| format!("Failed to get log stats: {}", e))
}

/// Export activity logs to a specific file
#[tauri::command]
pub async fn export_activity_logs(
    export_path: String,
    limit: Option<usize>,
    logger: State<'_, ActivityLoggerState>,
) -> Result<String, String> {
    let logs = logger.read_logs(limit)
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
    logger: State<'_, ActivityLoggerState>,
) -> Result<String, String> {
    let log_file_path = &logger.log_file_path;
    
    if create_backup {
        let backup_path = format!("{}.backup.{}", 
            log_file_path.display(), 
            chrono::Utc::now().format("%Y%m%d_%H%M%S")
        );
        
        if log_file_path.exists() {
            std::fs::copy(log_file_path, &backup_path)
                .map_err(|e| format!("Failed to create backup: {}", e))?;
        }
    }

    if log_file_path.exists() {
        std::fs::remove_file(log_file_path)
            .map_err(|e| format!("Failed to clear log file: {}", e))?;
    }

    Ok("Activity logs cleared successfully".to_string())
}
