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

/// Create a new auth user and corresponding profile using service role
#[tauri::command]
pub async fn create_user_account(
    email: String,
    password: String,
    first_name: String,
    last_name: String,
    phone: Option<String>,
    role: String,
) -> Result<String, String> {
    // Normalize email (Supabase treats emails case-insensitively)
    let email_norm = email.trim().to_lowercase();
    println!("🆕 Creating {} account for {}", role, email_norm);

    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkzMTA0NSwiZXhwIjoyMDY0NTA3MDQ1fQ.nXo0855nogbHoiB7TEEYJSpQOOhokUEIKaFlgbxWlHo";

    if password.len() < 6 { return Err("Password must be at least 6 characters".into()); }

    let client = reqwest::Client::new();

    // Helper to fetch user by email (handles 'email_exists' cases)
    async fn fetch_user_by_email(client: &reqwest::Client, supabase_url: &str, key: &str, email: &str) -> Result<Option<serde_json::Value>, String> {
        let url = format!("{}/auth/v1/admin/users?email=eq.{}", supabase_url, urlencoding::encode(email));
        let resp = client
            .get(&url)
            .header("apikey", key)
            .header("Authorization", format!("Bearer {}", key))
            .send().await.map_err(|e| format!("Lookup user failed: {}", e))?;
        if !resp.status().is_success() { return Ok(None); }
        let arr: serde_json::Value = resp.json().await.map_err(|e| format!("Parse lookup failed: {}", e))?;
        if let Some(first) = arr.as_array().and_then(|a| a.first()).cloned() { Ok(Some(first)) } else { Ok(None) }
    }

    // 1) Try create auth user via Admin API
    let admin_url = format!("{}/auth/v1/admin/users", supabase_url);
    let body = json!({
        "email": email_norm,
        "password": password,
        "email_confirm": true,
        "user_metadata": {
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "phone": phone
        }
    });

    let mut user_id_opt: Option<String> = None;
    let resp = client
        .post(&admin_url)
        .header("apikey", service_role_key)
        .header("Authorization", format!("Bearer {}", service_role_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Admin create user failed: {}", e))?;

    if resp.status().is_success() {
        let json_resp: serde_json::Value = resp.json().await.map_err(|e| format!("Parse admin response failed: {}", e))?;
        user_id_opt = json_resp.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
    } else {
        let text = resp.text().await.unwrap_or_default();
        // If email exists, fetch the existing user and continue
        if text.contains("email_exists") || text.contains("already been registered") {
            if let Some(existing) = fetch_user_by_email(&client, supabase_url, service_role_key, &email_norm).await? {
                user_id_opt = existing.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
                // Optionally update password and metadata
                if let Some(uid) = &user_id_opt {
                    let url = format!("{}/auth/v1/admin/users/{}", supabase_url, uid);
                    let upd = json!({
                        "password": password,
                        "user_metadata": {"first_name": first_name, "last_name": last_name, "role": role, "phone": phone}
                    });
                    let _ = client.put(&url)
                        .header("apikey", service_role_key)
                        .header("Authorization", format!("Bearer {}", service_role_key))
                        .header("Content-Type", "application/json")
                        .json(&upd).send().await; // ignore failure, we'll still try profile upsert
                }
            } else {
                return Err(format!("Create auth user failed: {}", text));
            }
        } else {
            return Err(format!("Create auth user failed: {}", text));
        }
    }

    let user_id = user_id_opt.ok_or("Missing user id from Admin API")?;

    // 2) Upsert profile row (handles existing or missing profile)
    let profiles_url = format!("{}/rest/v1/profiles", supabase_url);
    let profile_body = json!({
        "id": user_id,
        "email": email_norm,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "role": role,
        "suspended": false
    });

    let resp2 = client
        .post(&profiles_url)
        .header("apikey", service_role_key)
        .header("Authorization", format!("Bearer {}", service_role_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .query(&[("on_conflict", "id")])
        .json(&profile_body)
        .send()
        .await
        .map_err(|e| format!("Insert profile failed: {}", e))?;

    if !resp2.status().is_success() && resp2.status() != reqwest::StatusCode::CONFLICT {
        let text = resp2.text().await.unwrap_or_default();
        println!("❌ Upsert profile failed: {}", text);
        return Err(format!("Create profile failed: {}", text));
    }

    println!("✅ Ensured user {} with id {} and profile", email_norm, user_id);
    Ok(user_id)
}
