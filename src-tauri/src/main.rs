// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;
mod sync;

use commands::*;
use database::DatabaseManager;
use sync::{SyncEngine, SupabaseConfig};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Initialize database
    let app_data_dir = dirs::data_dir()
        .expect("Failed to get data directory")
        .join("shelf-serpent");
    
    std::fs::create_dir_all(&app_data_dir)?;
    
    let db_path = app_data_dir.join("library.db");
    let db_manager = Arc::new(
        DatabaseManager::new(db_path.to_str().unwrap())
            .expect("Failed to initialize database")
    );

    // Initialize sync engine with default config
    let supabase_config = SupabaseConfig {
        url: "https://your-project.supabase.co".to_string(),
        anon_key: "your-anon-key".to_string(),
    };
    
    let sync_engine = Arc::new(SyncEngine::new(db_manager.clone(), supabase_config));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(db_manager.clone())
        .manage(sync_engine.clone())
        .invoke_handler(tauri::generate_handler![
            // Book commands - Core offline-capable operations
            create_book,
            get_books,
            search_books,
            update_book,
            delete_book,
            
            // Student commands
            create_student,
            get_students,
            update_student,
            delete_student,
            
            // Category commands
            create_category,
            get_categories,
            
            // Analytics commands - Optimized for large datasets
            get_library_stats,
            
            // Sync commands - Hybrid online/offline capabilities
            get_sync_status,
            trigger_sync,
            get_cached_connectivity_status,
            check_connectivity,
            force_connectivity_refresh,
            setup_sync_config,
            get_connection_status,
            maintain_session,
            restore_session,
            initial_data_pull,
            check_local_data_count,
            
            // Database optimization commands
            optimize_database,
            get_database_info,
            
            // Utility commands
            generate_id,
            get_app_version,
        ])
        .setup(move |_app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Start sync service in background
            let sync_engine_clone = sync_engine.clone();
            tokio::spawn(async move {
                if let Err(e) = sync_engine_clone.start_sync_service().await {
                    eprintln!("Failed to start sync service: {}", e);
                }
            });

            // Trigger initial data pull if we're online and haven't synced yet
            let sync_engine_initial = sync_engine.clone();
            tokio::spawn(async move {
                // Wait a bit for the app to fully initialize
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                
                // Check if we need initial sync
                let status = sync_engine_initial.get_sync_status().await;
                if !status.initial_sync_completed && status.is_online {
                    if let Err(e) = sync_engine_initial.full_sync().await {
                        eprintln!("Failed to perform initial data pull: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
