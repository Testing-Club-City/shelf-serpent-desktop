use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserPasswordRequest {
    pub user_id: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserProfileRequest {
    pub user_id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub role: String,
}

/// Update user password using Supabase Admin API
#[tauri::command]
pub async fn update_user_password(
    user_id: String,
    new_password: String,
) -> Result<String, String> {
    println!("🔐 Updating password for user: {}", user_id);

    // Hardcoded Supabase credentials (matches frontend client.ts)
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkzMTA0NSwiZXhwIjoyMDY0NTA3MDQ1fQ.nXo0855nogbHoiB7TEEYJSpQOOhokUEIKaFlgbxWlHo";

    // Validate password length
    if new_password.len() < 6 {
        return Err("Password must be at least 6 characters long".to_string());
    }

    // Call Supabase Admin API to update password
    let client = reqwest::Client::new();
    let url = format!("{}/auth/v1/admin/users/{}", supabase_url, user_id);
    
    let body = json!({
        "password": new_password
    });

    println!("📡 Calling Supabase Admin API: {}", url);

    let response = client
        .put(&url)
        .header("apikey", service_role_key)
        .header("Authorization", format!("Bearer {}", service_role_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to call Supabase API: {}", e))?;

    let status = response.status();
    
    if status.is_success() {
        println!("✅ Password updated successfully for user: {}", user_id);
        Ok("Password updated successfully".to_string())
    } else {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        println!("❌ Failed to update password. Status: {}, Error: {}", status, error_text);
        Err(format!("Failed to update password: {} - {}", status, error_text))
    }
}

/// Update user profile in Supabase
#[tauri::command]
pub async fn update_user_profile(
    user_id: String,
    first_name: String,
    last_name: String,
    email: String,
    role: String,
) -> Result<String, String> {
    println!("👤 Updating profile for user: {}", user_id);

    // Hardcoded Supabase credentials (matches frontend client.ts)
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkzMTA0NSwiZXhwIjoyMDY0NTA3MDQ1fQ.nXo0855nogbHoiB7TEEYJSpQOOhokUEIKaFlgbxWlHo";

    // Call Supabase REST API to update profile
    let client = reqwest::Client::new();
    let url = format!("{}/rest/v1/profiles?id=eq.{}", supabase_url, user_id);
    
    let body = json!({
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "role": role
    });

    println!("📡 Calling Supabase REST API: {}", url);

    let response = client
        .patch(&url)
        .header("apikey", service_role_key)
        .header("Authorization", format!("Bearer {}", service_role_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to call Supabase API: {}", e))?;

    let status = response.status();
    
    if status.is_success() {
        println!("✅ Profile updated successfully for user: {}", user_id);
        Ok("Profile updated successfully".to_string())
    } else {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        println!("❌ Failed to update profile. Status: {}, Error: {}", status, error_text);
        Err(format!("Failed to update profile: {} - {}", status, error_text))
    }
}
