// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;
mod sync;
mod simple_sync;
// mod auth;

use commands::*;
use database::DatabaseManager;
// use auth::AuthManager;
use sync::SupabaseConfig;
use std::sync::Arc;
use sqlx::sqlite::SqlitePool;
use tauri::Manager;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Initialize database
    let app_data_dir = dirs::data_dir()
        .expect("Failed to get data directory")
        .join("library-management-system");
    
    std::fs::create_dir_all(&app_data_dir)?;
    
    let db_path = app_data_dir.join("library.db");
    let db_manager = Arc::new(
        DatabaseManager::new(db_path.to_str().unwrap())
            .expect("Failed to initialize database")
    );
    
    // Create SQLite pool for sync engine
    let sqlite_pool = SqlitePool::connect(db_path.to_str().unwrap()).await
        .expect("Failed to create SQLite pool");

    // Initialize sync engine with proper Supabase config
    let supabase_config = SupabaseConfig {
        url: "https://ddlzenlqkofefdwdefzm.supabase.co".to_string(),
        anon_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU".to_string(),
        batch_size: 100,
    };
    
    // Create remote data source
    let remote = Arc::new(sync::SupabaseRemoteDataSource::new(supabase_config)?);
    
    // Create local data store
    let local = Arc::new(sync::SqliteLocalDataStore::new(sqlite_pool));
    
    // Create conflict resolver
    let conflict_resolver = Arc::new(sync::DefaultConflictResolver);
    
    // Build sync engine using the builder pattern
    let sync_engine = Arc::new(
        sync::SyncEngineBuilder::new()
            .with_remote(remote)
            .with_local(local)
            .with_conflict_resolver(conflict_resolver)
            .build()
            .expect("Failed to build sync engine")
    );

    // Initialize AuthManager for offline-first authentication
    // let auth_manager = Arc::new(AuthManager::new(db_manager.clone()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .manage(db_manager.clone())
        .manage(sync_engine.clone())
        // .manage(auth_manager.clone())
        .invoke_handler(tauri::generate_handler![
            // Book commands - Core offline-capable operations
            create_book,
            get_books,
            search_books,
            update_book,
            delete_book,
            
            // Enhanced optimized operations
            batch_create_books,
            global_search,
            get_books_paginated,
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
            
            // Professional Sync Commands for UI
            sync_books_only,
            sync_categories_only,
            sync_students_only,
            sync_borrowings_only,
            sync_staff_only,
            sync_classes_only,
            sync_book_copies_only,
            sync_fines_only,
            sync_fine_settings_only,
            sync_group_borrowings_only,
            sync_theft_reports_only,
            sync_all_data,
            clear_local_database,
            get_local_data_stats,
            pull_all_database,
            
            // Session management commands
            save_user_session,
            get_cached_user_session,
            invalidate_user_session,
            is_session_valid_offline,
            cleanup_expired_sessions,
            
            // Enhanced Authentication Commands
            // authenticate_user,
            // store_authenticated_session,
            // get_stored_session,
            // logout_user,
            // cleanup_expired_auth_sessions,
            
            // Database optimization commands
            optimize_database,
            get_database_info,
            get_performance_stats,
            enhance_database_performance,
            
            // Utility commands
            generate_id,
            get_app_version,
        ])
        .setup(move |app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Make sync completely non-blocking and optional
            let _db_manager_clone = db_manager.clone();
            tokio::spawn(async move {
                // Wait longer for the app to fully initialize and be responsive
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                
                // Only sync if we have very few records (first time setup)
                let should_sync = match simple_sync::check_if_sync_needed().await {
                    Ok(needed) => needed,
                    Err(_) => false,
                };
                
                if should_sync {
                    println!("🚀 Starting automatic data sync...");
                    match simple_sync::sync_data_from_supabase().await {
                        Ok(_) => println!("✅ Automatic sync completed successfully!"),
                        Err(e) => eprintln!("❌ Automatic sync failed: {}", e),
                    }
                } else {
                    println!("📊 Database already has data, skipping automatic sync");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
