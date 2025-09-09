use tauri::command;
use serde_json::{json, Value};


#[command]
pub async fn get_sync_lock_status() -> Result<Value, String> {
    Ok(json!({
        "sync_in_progress": super::is_sync_in_progress(),
        "message": if super::is_sync_in_progress() {
            "Sync in progress - database operations are blocked"
        } else {
            "Database operations are available"
        }
    }))
}

#[command]
pub async fn force_unlock_sync() -> Result<Value, String> {
    super::end_sync();
    Ok(json!({
        "success": true,
        "message": "Sync lock forcefully released"
    }))
}