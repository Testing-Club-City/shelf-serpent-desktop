#![cfg_attr(debug_assertions, windows_subsystem = "console")]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;
mod sync;
mod simple_sync;
mod professional_sync;
mod sync_all_fixed;
mod logging;
mod fixed_borrowings_sync;
#[allow(dead_code)]
mod comprehensive_sync;
#[allow(dead_code)]
mod comprehensive_sync_methods;
#[allow(dead_code)]
mod comprehensive_sync_methods_part2;
mod fixed_categories_sync;
mod categories_diagnostic;
mod bidirectional_sync_complete;
#[allow(dead_code)]
mod bidirectional_sync;
mod add_synced_column_migration;
mod schema_mapper;
#[allow(dead_code)]
mod improved_bidirectional_sync;
#[allow(dead_code)]
mod sync_fix_comprehensive;
mod production_bidirectional_sync;
pub mod sync_lock;
// mod auth;

use commands::*;
use commands::books::search_book_copy_by_legacy_id;
use commands::fixed_sync_commands::{sync_borrowings_fixed, sync_group_borrowings_fixed, sync_all_borrowings_fixed};
use database::DatabaseManager;
// use auth::AuthManager;
use sync::SupabaseConfig;
use logging::ActivityLogger;
use std::sync::Arc;
use sqlx::sqlite::SqlitePool;
use tauri::{
    AppHandle, 
    Manager, 
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};
use tokio;

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
            // Show window without forcing resize if already maximized
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                
                // Only resize if window is not maximized or fullscreen
                let is_maximized = window.is_maximized().unwrap_or(false);
                let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                
                if !is_maximized && !is_fullscreen {
                    // Try to resize the window dynamically based on screen resolution
                    tokio::spawn(async move {
                        match set_window_size_to_screen_ratio(window.clone(), 16.0, 9.0, Some(1920.0), Some(1080.0)).await {
                            Ok(size_info) => {
                                println!("📏 Window resized dynamically based on screen resolution: {}x{}", 
                                    size_info["width"], size_info["height"]);
                            },
                            Err(e) => {
                                println!("⚠️ Failed to adjust window size dynamically: {}", e);
                            }
                        }
                    });
                }
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
    println!("🚀 Starting Library Management System...");
    
    // Initialize tracing with reduced verbosity for GUI framework warnings
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "tauri_app=info,warn,tao=error");
    }
    tracing_subscriber::fmt::init();
    println!("✅ Tracing initialized");

    // Initialize database
    println!("📂 Initializing database...");
    
    // Get app data directory for both Windows and non-Windows
    let app_data_dir = if cfg!(target_os = "windows") {
        dirs::data_dir()
            .expect("Failed to get data directory")
            .join("library-management-system")
    } else {
        dirs::data_dir()
            .expect("Failed to get data directory")
            .join("library-management-system")
    };
    
    std::fs::create_dir_all(&app_data_dir)?;
    
    // Use Windows-safe path handling for database
    let db_path = if cfg!(target_os = "windows") {
        database::windows_fixes::get_windows_safe_db_path()
            .map_err(|e| format!("Failed to get Windows database path: {}", e))?
    } else {
        app_data_dir.join("library.db")
    };
    
    let db_manager = Arc::new(
        DatabaseManager::new(db_path.to_str().unwrap())
            .expect("Failed to initialize database")
    );
    println!("✅ Database initialized at: {:?}", db_path);

    // Initialize activity logger
    println!("📝 Initializing activity logger...");
    let logs_dir = app_data_dir.join("logs");
    let activity_logger = Arc::new(
        ActivityLogger::new(logs_dir.clone())
            .expect("Failed to initialize activity logger")
    );
    println!("✅ Activity logger initialized at: {:?}", logs_dir);

    // Log application startup with detailed system info
    let _startup_time = std::time::Instant::now();
    activity_logger.log(&logging::ActivityLogEntry::new(
        logging::LogLevel::Info,
        "Application".to_string(),
        "Startup Initiated".to_string(),
    ).with_details(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "database_path": db_path.to_string_lossy(),
        "logs_directory": logs_dir.to_string_lossy(),
        "app_data_dir": app_data_dir.to_string_lossy(),
        "system_info": {
            "os": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "family": std::env::consts::FAMILY
        },
        "process_id": std::process::id(),
        "thread_id": format!("{:?}", std::thread::current().id())
    })));
    
    // Create SQLite pool for sync engine
    let db_start = std::time::Instant::now();
    println!("🔗 Creating SQLite pool...");
    activity_logger.log(&logging::ActivityLogEntry::new(
        logging::LogLevel::Info,
        "Database".to_string(),
        "SQLite Pool Creation Started".to_string(),
    ).with_details(serde_json::json!({
        "database_path": db_path.to_string_lossy()
    })));
    
    let sqlite_pool = match SqlitePool::connect(db_path.to_str().unwrap()).await {
        Ok(pool) => {
            let duration = db_start.elapsed();
            activity_logger.log(&logging::ActivityLogEntry::new(
                logging::LogLevel::Info,
                "Database".to_string(),
                "SQLite Pool Created".to_string(),
            ).with_details(serde_json::json!({
                "duration_ms": duration.as_millis(),
                "pool_size": "default"
            })).with_duration(duration.as_millis() as u64));
            println!("✅ SQLite pool created in {:?}", duration);
            pool
        }
        Err(e) => {
            activity_logger.log(&logging::ActivityLogEntry::new(
                logging::LogLevel::Error,
                "Database".to_string(),
                "SQLite Pool Creation Failed".to_string(),
            ).with_error(e.to_string(), None));
            panic!("Failed to create SQLite pool: {}", e);
        }
    };

    // Initialize sync engine with proper Supabase config
    let sync_start = std::time::Instant::now();
    println!("🔄 Initializing sync engine...");
    activity_logger.log(&logging::ActivityLogEntry::new(
        logging::LogLevel::Info,
        "Sync Engine".to_string(),
        "Initialization Started".to_string(),
    ));
    
    let supabase_config = SupabaseConfig {
        url: "https://ddlzenlqkofefdwdefzm.supabase.co".to_string(),
        anon_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU".to_string(),
        batch_size: 100,
    };
    
    activity_logger.log(&logging::ActivityLogEntry::new(
        logging::LogLevel::Debug,
        "Sync Engine".to_string(),
        "Supabase Config Loaded".to_string(),
    ).with_details(serde_json::json!({
        "url": supabase_config.url,
        "batch_size": supabase_config.batch_size
    })));
    
    // Create remote data source
            let remote: Arc<dyn sync::traits::RemoteDataSource + Send + Sync> = {
        match sync::SupabaseRemoteDataSource::new(supabase_config) {
            Ok(remote) => {
                println!("✅ Supabase remote data source initialized.");
                Arc::new(remote)
            }
            Err(e) => {
                println!("⚠️ Failed to initialize Supabase remote: {}. Using offline mode.", e);
                Arc::new(sync::offline::OfflineRemoteDataSource::new())
            }
        }
    };
    
    // Create local data store
    let local = Arc::new(sync::SqliteLocalDataStore::new(sqlite_pool));
    
    // Create conflict resolver
    let conflict_resolver = Arc::new(sync::DefaultConflictResolver);
    
    // Build sync engine using the builder pattern
    let sync_engine = match sync::SyncEngineBuilder::new()
        .with_remote(remote)
        .with_local(local)
        .with_conflict_resolver(conflict_resolver)
        .build() {
        Ok(engine) => {
            let duration = sync_start.elapsed();
            activity_logger.log(&logging::ActivityLogEntry::new(
                logging::LogLevel::Info,
                "Sync Engine".to_string(),
                "Built Successfully".to_string(),
            ).with_details(serde_json::json!({
                "duration_ms": duration.as_millis(),
                "components_initialized": ["remote", "local", "conflict_resolver"]
            })).with_duration(duration.as_millis() as u64));
            println!("✅ Sync engine initialized in {:?}", duration);
            engine
        }
        Err(e) => {
            activity_logger.log(&logging::ActivityLogEntry::new(
                logging::LogLevel::Error,
                "Sync Engine".to_string(),
                "Build Failed".to_string(),
            ).with_error(e.to_string(), None));
            panic!("Failed to build sync engine: {}", e);
        }
    };

    // Initialize AuthManager for offline-first authentication
    // let auth_manager = Arc::new(AuthManager::new(db_manager.clone()));

    println!("🖥️ Starting Tauri application...");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init()) // This will use the default configuration
        .plugin(tauri_plugin_http::init())
        .manage(db_manager.clone())
        .manage(sync_engine)
        .manage(activity_logger.clone())
        // .manage(auth_manager.clone())
        .invoke_handler(tauri::generate_handler![
            // Book commands - Core offline-capable operations
            create_book,
            create_book_with_copies,
            // test_book_copies_creation,
            get_books,
            update_book,
            delete_book,
            get_book_copies_by_book_id,
            add_book_copies,
            get_highest_copy_number,
            
            // Optimized book operations
            commands::books::get_books_fast,
            commands::books::get_books_paginated_books,
            commands::books::search_books_fast,
            commands::books::get_dashboard_stats,
            commands::books::initialize_performance_indexes,
            commands::books::find_borrowing_by_legacy_id,
            find_borrowing_by_legacy_book_id,
            
            // Enhanced optimized operations
            batch_create_books,
            global_search,
            get_books_paginated,
            
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
            upsert_class,
            
            // Borrowing commands - Core offline-capable operations
            get_borrowings,
            get_borrowings_by_student,
            get_borrowings_by_staff,
            get_fines_by_staff,
            get_fines_by_student,
            create_borrowing,
            return_book,
            get_group_borrowings,
            create_group_borrowing,
            update_group_borrowing,
            return_group_borrowing,
            upsert_group_borrowing,
            
            // Professional Bidirectional Sync Commands
            get_professional_sync_status,
            upload_local_borrowings,
            commands::upload_local_changes::upload_local_changes,
            full_bidirectional_sync,
            get_local_only_borrowings_count,
            check_sync_connectivity,
            auto_sync_if_needed,
            enable_auto_sync,
            disable_auto_sync,
            get_auto_sync_status,
            
            // Category commands
            create_category,
            get_categories,
            update_category,
            delete_category,
            
            // Analytics commands - Optimized for large datasets
            get_library_stats,
            
            // Sync commands - Hybrid online/offline capabilities
            get_sync_status,
            trigger_sync,
            get_cached_connectivity_status,
            check_connectivity,
            check_connectivity_cached,
            check_supabase_connection_cached,
            force_connectivity_refresh,
            check_supabase_connection,
            setup_sync_config,
            get_connection_status,
            maintain_session,
            restore_session,
            initial_data_pull,
            check_local_data_count,
            
            // Fast connectivity commands for optimized mode switching
            commands::fast_connectivity::check_connectivity_ultra_fast,
            commands::fast_connectivity::check_supabase_connection_fast,
            commands::fast_connectivity::get_pending_changes_count,
            commands::fast_connectivity::pause_sync_operations,
            commands::fast_connectivity::resume_sync_operations,
            commands::fast_connectivity::is_sync_paused,
            commands::fast_connectivity::clear_connectivity_cache,
            commands::fast_connectivity::get_connectivity_cache_status,
            // commands::fast_connectivity::sync_table_incremental, // Disabled until incremental_sync module is implemented
            
            // Professional Sync Commands for UI
            sync_books_only,
            sync_categories_only,
            sync_categories_fixed,
            diagnose_categories_conflicts,
            cleanup_duplicate_categories,
            run_complete_bidirectional_sync,
            sync_categories_bidirectional,
            sync_classes_bidirectional,
            fixed_comprehensive_sync,
            run_database_migration,
            run_improved_bidirectional_sync,
            run_production_bidirectional_sync,
            run_multithreaded_bidirectional_sync,
            run_complete_migration_and_improved_sync,
            commands::sync_status::get_sync_lock_status,
            commands::sync_status::force_unlock_sync,
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
            
            // Fixed Sync Commands with Validation
            sync_borrowings_fixed,
            sync_group_borrowings_fixed,
            sync_all_borrowings_fixed,
            clear_local_database,
            get_local_data_stats,
            pull_all_database,
            professional_pull_all_database,
            comprehensive_sync_from_supabase,
            run_comprehensive_sync_fix,
            cleanup_invalid_borrowings,
            migrate_fine_settings_schema,
            commands::enhanced_book_search::progressive_tracking_code_search,
            commands::enhanced_book_search::search_books_by_code_or_title,
            commands::enhanced_book_search::search_book_copies_by_legacy_id,
            
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
            
            // Window management commands
            minimize_window,
            maximize_window,
            unmaximize_window,
            toggle_fullscreen,
            is_window_maximized,
            is_window_fullscreen,
            close_window,
            zoom_in,
            zoom_out,
            get_screen_resolution,
            set_window_size_to_screen_ratio,
            set_window_size,
            set_window_position,
            center_window,
            
            // Utility commands
            generate_id,
            get_app_version,
            
            // Activity logging commands
            init_activity_logger,
            log_activity_entry,
            log_simple_activity,
            get_activity_logs,
            get_activity_log_stats,
            export_activity_logs,
            clear_activity_logs,
            
            // Ultra-fast book verification
            verify_book_instant,
            
            // Book search commands
            search_book_copy_by_legacy_id,
            commands::simple_book_search::simple_search_book_by_legacy_id,
            search_book_copy_by_tracking,
            search_book_copy_by_id,
            search_student_by_admission,
            search_staff_borrowings,
            get_next_legacy_book_id,
            
            // Database maintenance commands
            fix_isbn_constraint,
            fix_borrowing_book_references,
            fix_missing_book_codes,
            
            // File system commands
            open_file,
            open_folder,
            save_file,
            
            // Report commands
            commands::reports::get_books_by_supplier,
            commands::reports::get_staff_overdue_books,
            commands::reports::get_student_overdue_books,
            commands::reports::get_books_by_category,
            commands::reports::get_borrowing_statistics,
            commands::reports::get_popular_books,
            commands::reports::get_class_borrowing_report,
            commands::reports::get_fine_reports,
            commands::reports::get_lost_books,
            commands::reports::get_theft_reports,
        ])
        .setup(move |app| {
            let _setup_start = std::time::Instant::now();
            println!("🎯 Setting up Tauri application...");
            activity_logger.log(&logging::ActivityLogEntry::new(
                logging::LogLevel::Info,
                "Tauri".to_string(),
                "Setup Started".to_string(),
            ));
            
            // Create system tray with sync operations
            let tray_start = std::time::Instant::now();
            let tray_menu = create_tray_menu(app.handle())?;
            // Create clones for tray event handlers
            let activity_logger_menu = activity_logger.clone();
            let activity_logger_tray = activity_logger.clone();
            
            let tray_result = TrayIconBuilder::new()
                .menu(&tray_menu)
                .on_menu_event(move |app, event| {
                    let event_start = std::time::Instant::now();
                    activity_logger_menu.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Debug,
                        "System Tray".to_string(),
                        "Menu Event".to_string(),
                    ).with_details(serde_json::json!({
                        "event_id": event.id().as_ref()
                    })));
                    handle_tray_event(app, event);
                    let duration = event_start.elapsed();
                    activity_logger_menu.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Trace,
                        "System Tray".to_string(),
                        "Menu Event Handled".to_string(),
                    ).with_duration(duration.as_millis() as u64));
                })
                .on_tray_icon_event(move |tray, event| {
                    let tray_event_start = std::time::Instant::now();
                    activity_logger_tray.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Debug,
                        "System Tray".to_string(),
                        "Tray Icon Event".to_string(),
                    ).with_details(serde_json::json!({
                        "event_type": format!("{:?}", event)
                    })));
                    
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    
                    let duration = tray_event_start.elapsed();
                    activity_logger_tray.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Trace,
                        "System Tray".to_string(),
                        "Tray Event Handled".to_string(),
                    ).with_duration(duration.as_millis() as u64));
                })
                .build(app);
                
            match tray_result {
                Ok(_) => {
                    let duration = tray_start.elapsed();
                    activity_logger.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Info,
                        "System Tray".to_string(),
                        "Created Successfully".to_string(),
                    ).with_duration(duration.as_millis() as u64));
                }
                Err(e) => {
                    activity_logger.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Error,
                        "System Tray".to_string(),
                        "Creation Failed".to_string(),
                    ).with_error(e.to_string(), None));
                }
            }
            
            // Clone app handle for async task
            let app_handle = app.handle().clone();
            let activity_logger_setup = activity_logger.clone();
            
            // Spawn async task for window setup
            tauri::async_runtime::spawn(async move {
                // Window setup for debug builds
                #[cfg(debug_assertions)]
                {
                    // Ensure the main window is visible and focused with error handling
                    let _window_start = std::time::Instant::now();
                    if let Some(window) = app_handle.get_webview_window("main") {
                        activity_logger_setup.log(&logging::ActivityLogEntry::new(
                            logging::LogLevel::Info,
                            "Window".to_string(),
                            "Window Found".to_string(),
                        ));
                        
                        println!("🖼️ Making sure main window is visible...");
                        
                        // Add delay to ensure WebView2 is ready
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        
                        // Show window first
                        let mut operations = Vec::new();
                        
                        if let Err(e) = window.show() {
                            operations.push(("show", e.to_string()));
                            activity_logger_setup.log(&logging::ActivityLogEntry::new(
                                logging::LogLevel::Warning,
                                "Window".to_string(),
                                "Show Failed".to_string(),
                            ).with_error(e.to_string(), None));
                        } else {
                            operations.push(("show", "success".to_string()));
                        }
                        
                        if let Err(e) = window.set_focus() {
                            operations.push(("focus", e.to_string()));
                            activity_logger_setup.log(&logging::ActivityLogEntry::new(
                                logging::LogLevel::Warning,
                                "Window".to_string(),
                                "Focus Failed".to_string(),
                            ).with_error(e.to_string(), None));
                        } else {
                            operations.push(("focus", "success".to_string()));
                        }
                        
                        // Only adjust window size if not maximized or fullscreen
                        let is_maximized = window.is_maximized().unwrap_or(false);
                        let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                        
                        if !is_maximized && !is_fullscreen {
                            match set_window_size_to_screen_ratio(window.clone(), 16.0, 9.0, Some(1920.0), Some(1080.0)).await {
                                Ok(size_info) => {
                                    println!("📏 Window resized dynamically based on screen resolution: {}x{}", 
                                        size_info["width"], size_info["height"]);
                                },
                                Err(e) => {
                                    println!("⚠️ Failed to adjust window size dynamically: {}", e);
                                }
                            }
                        } else {
                            println!("📏 Skipping window resize - window is maximized or fullscreen");
                        }
                        
                        println!("🔧 Window operations completed: {:?}", operations);
                    }
                }
                
                // Window setup for release builds
                #[cfg(not(debug_assertions))]
                {
                    // Release build window setup with dynamic sizing
                    let _window_start = std::time::Instant::now();
                    if let Some(window) = app_handle.get_webview_window("main") {
                        activity_logger_setup.log(&logging::ActivityLogEntry::new(
                            logging::LogLevel::Info,
                            "Window".to_string(),
                            "Window Found".to_string(),
                        ));
                        
                        // Add delay to ensure WebView2 is ready
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        
                        // Show window first
                        let mut operations = Vec::new();
                        
                        if let Err(e) = window.show() {
                            operations.push(("show", e.to_string()));
                            activity_logger_setup.log(&logging::ActivityLogEntry::new(
                                logging::LogLevel::Warning,
                                "Window".to_string(),
                                "Show Failed".to_string(),
                            ).with_error(e.to_string(), None));
                        } else {
                            operations.push(("show", "success".to_string()));
                        }
                        
                        if let Err(e) = window.set_focus() {
                            operations.push(("focus", e.to_string()));
                            activity_logger_setup.log(&logging::ActivityLogEntry::new(
                                logging::LogLevel::Warning,
                                "Window".to_string(),
                                "Focus Failed".to_string(),
                            ).with_error(e.to_string(), None));
                        } else {
                            operations.push(("focus", "success".to_string()));
                        }
                        
                        // Only adjust window size if not maximized or fullscreen
                        let is_maximized = window.is_maximized().unwrap_or(false);
                        let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                        
                        if !is_maximized && !is_fullscreen {
                            match set_window_size_to_screen_ratio(window.clone(), 16.0, 9.0, Some(1920.0), Some(1080.0)).await {
                                Ok(size_info) => {
                                    println!("📏 Window resized dynamically based on screen resolution: {}x{}", 
                                        size_info["width"], size_info["height"]);
                                },
                                Err(e) => {
                                    println!("⚠️ Failed to adjust window size dynamically: {}", e);
                                }
                            }
                        } else {
                            println!("📏 Skipping window resize - window is maximized or fullscreen");
                        }
                        
                        println!("🔧 Window operations completed: {:?}", operations);
                    }
                }
            });
            
            // Initialize background tasks
            let activity_logger_clone = activity_logger.clone();
            tauri::async_runtime::spawn(async move {
                println!("🔄 Initializing background tasks...");
                activity_logger_clone.log(&logging::ActivityLogEntry::new(
                    logging::LogLevel::Info,
                    "Background".to_string(),
                    "Initialization Started".to_string(),
                ));
                
                // Only sync if we have very few records (first time setup)
                let should_sync = match simple_sync::check_if_sync_needed().await {
                    Ok(needed) => {
                        println!("📊 Sync needed: {}", needed);
                        activity_logger_clone.log(&logging::ActivityLogEntry::new(
                            logging::LogLevel::Info,
                            "Background".to_string(),
                            "Sync Check Completed".to_string(),
                        ).with_details(serde_json::json!({
                            "sync_needed": needed
                        })));
                        needed
                    },
                    Err(e) => {
                        println!("⚠️ Error checking sync status: {}", e);
                        activity_logger_clone.log(&logging::ActivityLogEntry::new(
                            logging::LogLevel::Error,
                            "Background".to_string(),
                            "Sync Check Failed".to_string(),
                        ).with_error(e.to_string(), None));
                        false
                    },
                };
                
                if should_sync {
                    println!("🚀 Starting automatic data sync...");
                    activity_logger_clone.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Info,
                        "Background".to_string(),
                        "Auto Sync Started".to_string(),
                    ));
                    
                    match simple_sync::sync_data_from_supabase().await {
                        Ok(_) => {
                            println!("✅ Automatic sync completed successfully!");
                            activity_logger_clone.log(&logging::ActivityLogEntry::new(
                                logging::LogLevel::Info,
                                "Background".to_string(),
                                "Auto Sync Completed".to_string(),
                            ));
                        },
                        Err(e) => {
                            eprintln!("❌ Automatic sync failed: {}", e);
                            activity_logger_clone.log(&logging::ActivityLogEntry::new(
                                logging::LogLevel::Error,
                                "Background".to_string(),
                                "Auto Sync Failed".to_string(),
                            ).with_error(e.to_string(), None));
                            println!("📱 App will continue to work offline");
                        },
                    }
                } else {
                    println!("📊 Database already has data, skipping automatic sync");
                    activity_logger_clone.log(&logging::ActivityLogEntry::new(
                        logging::LogLevel::Info,
                        "Background".to_string(),
                        "Sync Skipped - Data Exists".to_string(),
                    ));
                }
                println!("🎉 Background initialization completed!");
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            let _event_time = std::time::Instant::now();
            match event {
                tauri::WindowEvent::Resized { .. } => {
                    // Don't auto-center on resize to allow proper maximize/fullscreen behavior
                    // Only center if the window is not maximized or fullscreen
                    if let Some(main_window) = window.get_webview_window("main") {
                        // Check if window is maximized or fullscreen before centering
                        let is_maximized = main_window.is_maximized().unwrap_or(false);
                        let is_fullscreen = main_window.is_fullscreen().unwrap_or(false);
                        
                        if !is_maximized && !is_fullscreen {
                            let _ = main_window.center();
                        }
                    }
                }
                tauri::WindowEvent::Focused(focused) => {
                    println!("🪟 Window focus changed: {}", focused);
                }
                tauri::WindowEvent::CloseRequested { .. } => {
                    println!("🚪 Close requested");
                }
                tauri::WindowEvent::Destroyed => {
                    println!("💥 Window destroyed");
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
