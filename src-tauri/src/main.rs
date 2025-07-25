// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod sync;

use anyhow::Result;
use database::{DatabaseManager, Book};
use sync::SyncService;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

// Application state
pub struct AppState {
    pub db: Arc<DatabaseManager>,
    pub sync_service: Arc<SyncService>,
}

#[tauri::command]
async fn get_books(
    state: State<'_, AppState>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<Book>, String> {
    state.db.get_books(limit, offset)
        .await
        .map_err(|e| format!("Failed to get books: {}", e))
}

#[tauri::command]
async fn search_books(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Book>, String> {
    state.db.search_books(&query)
        .await
        .map_err(|e| format!("Failed to search books: {}", e))
}

#[tauri::command]
async fn get_book_by_barcode(
    state: State<'_, AppState>,
    barcode: String,
) -> Result<Option<Book>, String> {
    state.db.get_book_by_barcode(&barcode)
        .await
        .map_err(|e| format!("Failed to get book by barcode: {}", e))
}

#[tauri::command]
async fn get_dashboard_stats(
    state: State<'_, AppState>,
) -> Result<Value, String> {
    state.db.get_dashboard_stats()
        .await
        .map_err(|e| format!("Failed to get dashboard stats: {}", e))
}

#[tauri::command]
async fn force_sync(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.sync_service.force_sync()
        .await
        .map_err(|e| format!("Failed to force sync: {}", e))
}

#[tauri::command]
async fn get_sync_status(
    state: State<'_, AppState>,
) -> Result<Value, String> {
    Ok(state.sync_service.get_sync_status().await)
}

async fn initialize_app(app: &AppHandle) -> Result<AppState> {
    // Initialize logging
    env_logger::init();
    
    // Get app data directory
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
    
    // Create app data directory if it doesn't exist
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| anyhow::anyhow!("Failed to create app data directory: {}", e))?;
    }
    
    // Initialize database
    let db_path = app_data_dir.join("library.db");
    let db = Arc::new(
        DatabaseManager::new(db_path)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to initialize database: {}", e))?
    );
    
    // Initialize sync service
    let sync_service = Arc::new(SyncService::new(Arc::clone(&db)));
    
    // Start background sync
    let sync_service_clone: Arc<SyncService> = Arc::clone(&sync_service);
    tokio::spawn(async move {
        if let Err(e) = sync_service_clone.start_background_sync().await {
            log::error!("Background sync failed: {}", e);
        }
    });
    
    log::info!("Application initialized successfully");
    
    Ok(AppState {
        db,
        sync_service,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Initialize app state in async context
            tauri::async_runtime::spawn(async move {
                match initialize_app(&handle).await {
                    Ok(state) => {
                        handle.manage(state);
                        log::info!("App state initialized successfully");
                    }
                    Err(e) => {
                        log::error!("Failed to initialize app state: {}", e);
                        std::process::exit(1);
                    }
                }
            });
            
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            get_books,
            search_books,
            get_book_by_barcode,
            get_dashboard_stats,
            force_sync,
            get_sync_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
