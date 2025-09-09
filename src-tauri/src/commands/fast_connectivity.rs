use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde_json::{json, Value};
use tokio::time::timeout;
use reqwest;

// Fast connectivity cache with TTL
#[derive(Clone)]
struct ConnectivityCache {
    result: bool,
    quality: String,
    timestamp: Instant,
    ttl: Duration,
}

lazy_static::lazy_static! {
    static ref CONNECTIVITY_CACHE: Arc<Mutex<Option<ConnectivityCache>>> = Arc::new(Mutex::new(None));
    static ref SYNC_PAUSE_STATE: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
}

// Ultra-fast connectivity check with aggressive caching
#[tauri::command]
pub async fn check_connectivity_ultra_fast() -> Result<Value, String> {
    let now = Instant::now();
    
    // Check cache first
    {
        let cache = CONNECTIVITY_CACHE.lock().unwrap();
        if let Some(cached) = cache.as_ref() {
            if now.duration_since(cached.timestamp) < cached.ttl {
                return Ok(json!({
                    "connected": cached.result,
                    "quality": cached.quality,
                    "cached": true,
                    "age_ms": now.duration_since(cached.timestamp).as_millis()
                }));
            }
        }
    }
    
    // Skip browser check in Tauri (not available)
    let browser_online = true; // Assume online for initial check
    
    if !browser_online {
        let cache_entry = ConnectivityCache {
            result: false,
            quality: "offline".to_string(),
            timestamp: now,
            ttl: Duration::from_secs(10), // Short TTL for offline state
        };
        
        *CONNECTIVITY_CACHE.lock().unwrap() = Some(cache_entry);
        
        return Ok(json!({
            "connected": false,
            "quality": "offline",
            "cached": false,
            "source": "browser"
        }));
    }
    
    // Fast network test with very short timeout
    let start_time = Instant::now();
    let connectivity_result = test_network_connectivity().await;
    let response_time = start_time.elapsed();
    
    let (connected, quality) = match connectivity_result {
        Ok(true) => {
            let quality = if response_time < Duration::from_millis(200) {
                "excellent"
            } else if response_time < Duration::from_millis(800) {
                "good"
            } else {
                "poor"
            };
            (true, quality.to_string())
        },
        Ok(false) => (false, "disconnected".to_string()),
        Err(_) => {
            // On error, assume connected but poor quality
            (browser_online, "poor".to_string())
        }
    };
    
    // Cache the result with adaptive TTL
    let ttl = if connected {
        if quality == "excellent" {
            Duration::from_secs(60) // Cache excellent connections longer
        } else {
            Duration::from_secs(30) // Cache poor connections shorter
        }
    } else {
        Duration::from_secs(10) // Cache disconnected state briefly
    };
    
    let cache_entry = ConnectivityCache {
        result: connected,
        quality: quality.clone(),
        timestamp: now,
        ttl,
    };
    
    *CONNECTIVITY_CACHE.lock().unwrap() = Some(cache_entry);
    
    Ok(json!({
        "connected": connected,
        "quality": quality,
        "cached": false,
        "response_time_ms": response_time.as_millis(),
        "source": "network_test"
    }))
}

// Minimal network connectivity test
async fn test_network_connectivity() -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    // Use multiple fast endpoints for redundancy
    let test_urls = vec![
        "https://1.1.1.1", // Cloudflare DNS (very fast)
        "https://8.8.8.8", // Google DNS
        "https://httpbin.org/status/200", // HTTP test endpoint
    ];
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1500)) // Very short timeout
        .build()?;
    
    // Test the fastest endpoint first
    for url in test_urls {
        match timeout(Duration::from_millis(1000), client.head(url).send()).await {
            Ok(Ok(response)) => {
                if response.status().is_success() {
                    return Ok(true);
                }
            },
            _ => continue, // Try next endpoint
        }
    }
    
    Ok(false)
}

// Fast Supabase connection check with caching
#[tauri::command]
pub async fn check_supabase_connection_fast() -> Result<Value, String> {
    // Check if sync is paused
    if *SYNC_PAUSE_STATE.lock().unwrap() {
        return Ok(json!({
            "connected": false,
            "reason": "sync_paused",
            "message": "Sync operations are paused"
        }));
    }
    
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let start_time = Instant::now();
    
    // Simple HEAD request to check connectivity
    let test_url = format!("{}/rest/v1/books?limit=1", supabase_url);
    
    match timeout(
        Duration::from_millis(1500),
        client
            .head(&test_url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .send()
    ).await {
        Ok(Ok(response)) => {
            let response_time = start_time.elapsed();
            let connected = response.status().is_success();
            
            Ok(json!({
                "connected": connected,
                "response_time_ms": response_time.as_millis(),
                "status_code": response.status().as_u16(),
                "quality": if response_time < Duration::from_millis(500) { "good" } else { "slow" }
            }))
        },
        Ok(Err(e)) => {
            Ok(json!({
                "connected": false,
                "error": e.to_string(),
                "response_time_ms": start_time.elapsed().as_millis()
            }))
        },
        Err(_) => {
            Ok(json!({
                "connected": false,
                "error": "timeout",
                "response_time_ms": start_time.elapsed().as_millis()
            }))
        }
    }
}

// Get pending changes count quickly
#[tauri::command]
pub async fn get_pending_changes_count() -> Result<u32, String> {
    use crate::database::DatabaseManager;
    
    let db = DatabaseManager::new("library.db")
        .map_err(|e| format!("Database connection failed: {}", e))?;
    
    // Quick count of unsynced records across key tables
    let tables = vec!["borrowings", "students", "books", "categories"];
    let mut total_pending = 0;
    
    for table in tables {
        match db.get_unsynced_count(table) {
            Ok(count) => total_pending += count as u32,
            Err(_) => continue, // Skip tables that don't have sync columns
        }
    }
    
    Ok(total_pending)
}

// Pause sync operations during critical operations
#[tauri::command]
pub async fn pause_sync_operations() -> Result<(), String> {
    *SYNC_PAUSE_STATE.lock().unwrap() = true;
    tracing::info!("🔇 Sync operations paused");
    Ok(())
}

// Resume sync operations
#[tauri::command]
pub async fn resume_sync_operations() -> Result<(), String> {
    *SYNC_PAUSE_STATE.lock().unwrap() = false;
    tracing::info!("🔊 Sync operations resumed");
    Ok(())
}

// Check if sync is paused
#[tauri::command]
pub async fn is_sync_paused() -> Result<bool, String> {
    Ok(*SYNC_PAUSE_STATE.lock().unwrap())
}

// Clear connectivity cache (force refresh)
#[tauri::command]
pub async fn clear_connectivity_cache() -> Result<(), String> {
    *CONNECTIVITY_CACHE.lock().unwrap() = None;
    tracing::info!("🗑️ Connectivity cache cleared");
    Ok(())
}

// Get connectivity cache status
#[tauri::command]
pub async fn get_connectivity_cache_status() -> Result<Value, String> {
    let cache = CONNECTIVITY_CACHE.lock().unwrap();
    
    match cache.as_ref() {
        Some(cached) => {
            let age = Instant::now().duration_since(cached.timestamp);
            let is_valid = age < cached.ttl;
            
            Ok(json!({
                "has_cache": true,
                "connected": cached.result,
                "quality": cached.quality,
                "age_ms": age.as_millis(),
                "ttl_ms": cached.ttl.as_millis(),
                "is_valid": is_valid
            }))
        },
        None => {
            Ok(json!({
                "has_cache": false
            }))
        }
    }
}

// Incremental sync for specific table (non-blocking) - Disabled until incremental_sync module is implemented
// #[tauri::command]
// pub async fn sync_table_incremental(table_name: String, limit: Option<u32>) -> Result<u32, String> {
//     // Implementation will be added when incremental_sync module is ready
//     Err("Incremental sync not yet implemented".to_string())
// }