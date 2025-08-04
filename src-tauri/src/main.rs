// Temporarily enable console window on Windows for debugging
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
use tauri::{
    AppHandle, 
    Manager, 
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};

// Function to create the system tray menu
fn create_tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    
    // Simple menu - just show/hide and quit
    menu.append(&MenuItem::with_id(app, "show_app", "Show Library Manager", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "hide_app", "Hide to Tray", true, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
    
    Ok(menu)
}

// Function to handle tray menu events
fn handle_tray_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "show_app" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "hide_app" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing with reduced verbosity for GUI framework warnings
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "tauri_app=info,warn,tao=error");
    }
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
            
            // Staff commands
            create_staff,
            get_staff,
            update_staff,
            delete_staff,
            
            // Class commands
            create_class,
            get_classes,
            update_class,
            delete_class,
            
            // Borrowing commands - Core offline-capable operations
            get_borrowings,
            create_borrowing,
            return_book,
            
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
            // Create system tray with sync operations
            let tray_menu = create_tray_menu(app.handle())?;
            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .on_menu_event(move |app, event| handle_tray_event(app, event))
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            #[cfg(debug_assertions)]
            {
                let _window = app.get_webview_window("main").unwrap();
                // _window.open_devtools(); // Method not available in this Tauri version
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
