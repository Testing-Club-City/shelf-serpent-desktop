use tauri::command;
use crate::fixed_borrowings_sync::{sync_borrowings_with_validation, sync_group_borrowings_with_validation};

#[command]
pub async fn sync_borrowings_fixed() -> Result<String, String> {
    match sync_borrowings_with_validation().await {
        Ok(count) => Ok(format!("Successfully synced {} borrowings with validation", count)),
        Err(e) => Err(format!("Failed to sync borrowings: {}", e)),
    }
}

#[command]
pub async fn sync_group_borrowings_fixed() -> Result<String, String> {
    match sync_group_borrowings_with_validation().await {
        Ok(count) => Ok(format!("Successfully synced {} group borrowings with validation", count)),
        Err(e) => Err(format!("Failed to sync group borrowings: {}", e)),
    }
}

#[command]
pub async fn sync_all_borrowings_fixed() -> Result<String, String> {
    let mut results = Vec::new();
    
    // Sync regular borrowings first
    match sync_borrowings_with_validation().await {
        Ok(count) => results.push(format!("✅ Borrowings: {} synced", count)),
        Err(e) => results.push(format!("❌ Borrowings failed: {}", e)),
    }
    
    // Then sync group borrowings
    match sync_group_borrowings_with_validation().await {
        Ok(count) => results.push(format!("✅ Group borrowings: {} synced", count)),
        Err(e) => results.push(format!("❌ Group borrowings failed: {}", e)),
    }
    
    Ok(results.join("\n"))
}
