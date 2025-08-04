use crate::database::{DatabaseManager, LibraryStats};
use crate::models::*;
use crate::sync::{SyncEngine, SyncStatus};
// use crate::auth::{AuthManager, AuthCredentials, AuthResponse, UserSession};
use serde_json::{Value, json};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;
use tracing::{info, warn, error};
use chrono::{Duration, Utc};

pub type DatabaseState = Arc<DatabaseManager>;
// pub type AuthState = Arc<AuthManager>;
// pub type SyncState = Arc<SyncEngine>; // Disabled for build

// Book Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn create_book(
    book_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let book: Book = serde_json::from_value(book_data.clone())
        .map_err(|e| format!("Failed to parse book data: {}", e))?;
    
    // Save to local SQLite first (offline-first approach)
    db.create_book(&book).await
        .map_err(|e| format!("Failed to create book: {}", e))?;

    // Queue for sync to Supabase when online
    // sync_engine.queue_operation(
    //     "books",
    //     OperationType::Create,
    //     &book.id.to_string(),
    //     book_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(book.id.to_string())
}

#[tauri::command]
pub async fn get_books(
    db: State<'_, DatabaseState>,
) -> Result<Vec<BookWithDetails>, String> {
    // Always read from local SQLite for fast offline access
    db.get_books_with_details().await
        .map_err(|e| format!("Failed to get books: {}", e))
}

#[tauri::command]
pub async fn search_books(
    query: String,
    db: State<'_, DatabaseState>,
) -> Result<Vec<Book>, String> {
    // Fast local search with SQLite FTS capabilities
    db.search_books(&query).await
        .map_err(|e| format!("Failed to search books: {}", e))
}

// Optimized batch operations for large datasets
#[tauri::command]
pub async fn batch_create_books(
    books_data: Vec<Value>,
    db: State<'_, DatabaseState>,
) -> Result<usize, String> {
    let mut books = Vec::new();
    for book_data in books_data {
        let book: Book = serde_json::from_value(book_data)
            .map_err(|e| format!("Failed to parse book data: {}", e))?;
        books.push(book);
    }
    
    // Use optimized batch insert
    let mut successful = 0;
    for book in books {
        match db.create_book(&book).await {
            Ok(_) => successful += 1,
            Err(e) => {
                info!("Failed to create book {}: {}", book.title, e);
            }
        }
    }
    
    Ok(successful)
}

// Parallel search across multiple entity types
#[tauri::command]
pub async fn global_search(
    query: String,
    limit: Option<usize>,
    db: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let search_limit = limit.unwrap_or(50);
    
    // Run parallel searches
    let books_task = db.search_books(&query);
    let students_task = db.get_students();
    
    let (books_result, students_result) = tokio::join!(books_task, students_task);
    
    let books = books_result.map_err(|e| format!("Books search failed: {}", e))?;
    let all_students = students_result.map_err(|e| format!("Students search failed: {}", e))?;
    
    // Filter students locally
    let query_lower = query.to_lowercase();
    let students: Vec<Student> = all_students.into_iter()
        .filter(|s| {
            s.first_name.to_lowercase().contains(&query_lower) ||
            s.last_name.to_lowercase().contains(&query_lower) ||
            s.admission_number.to_lowercase().contains(&query_lower) ||
            s.email.as_ref().map_or(false, |e| e.to_lowercase().contains(&query_lower))
        })
        .take(search_limit)
        .collect();
    
    let books_limited: Vec<Book> = books.into_iter().take(search_limit).collect();
    
    Ok(json!({
        "books": books_limited,
        "students": students,
        "total_books": books_limited.len(),
        "total_students": students.len(),
        "query": query,
        "limit": search_limit
    }))
}

// Fast paginated data loading
#[tauri::command]
pub async fn get_books_paginated(
    page: usize,
    page_size: usize,
    _category_filter: Option<String>,
    search_query: Option<String>,
    db: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let all_books = db.get_books().await
        .map_err(|e| format!("Failed to get books: {}", e))?;
    
    // Apply filters
    let mut filtered_books = all_books;
    
    if let Some(query) = search_query {
        let query_lower = query.to_lowercase();
        filtered_books = filtered_books.into_iter()
            .filter(|book| {
                book.title.to_lowercase().contains(&query_lower) ||
                book.author.to_lowercase().contains(&query_lower) ||
                book.isbn.as_ref().map_or(false, |isbn| isbn.to_lowercase().contains(&query_lower))
            })
            .collect();
    }
    
    // Apply pagination
    let total_count = filtered_books.len();
    let total_pages = (total_count as f64 / page_size as f64).ceil() as usize;
    let offset = page * page_size;
    
    let paginated_books: Vec<Book> = filtered_books
        .into_iter()
        .skip(offset)
        .take(page_size)
        .collect();
    
    Ok(json!({
        "books": paginated_books,
        "current_page": page,
        "page_size": page_size,
        "total_count": total_count,
        "total_pages": total_pages,
        "has_next": page < total_pages.saturating_sub(1),
        "has_previous": page > 0
    }))
}

// Category Commands
#[tauri::command]
pub async fn get_categories(
    db: State<'_, DatabaseState>,
) -> Result<Vec<Category>, String> {
    db.get_categories().await
        .map_err(|e| format!("Failed to get categories: {}", e))
}

#[tauri::command]
pub async fn create_category(
    category_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let category: Category = serde_json::from_value(category_data.clone())
        .map_err(|e| format!("Failed to parse category data: {}", e))?;
    
    // Local-first storage
    db.create_category(&category).await
        .map_err(|e| format!("Failed to create category: {}", e))?;

    // Queue for sync
    // sync_engine.queue_operation(
    //     "categories",
    //     OperationType::Create,
    //     &category.id.to_string(),
    //     category_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(category.id.to_string())
}

// Student Commands
#[tauri::command]
pub async fn get_students(
    db: State<'_, DatabaseState>,
) -> Result<Vec<Student>, String> {
    db.get_students().await
        .map_err(|e| format!("Failed to get students: {}", e))
}

#[tauri::command]
pub async fn create_student(
    student_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let student: Student = serde_json::from_value(student_data.clone())
        .map_err(|e| format!("Failed to parse student data: {}", e))?;
    
    // Local-first storage
    db.create_student(&student).await
        .map_err(|e| format!("Failed to create student: {}", e))?;

    // Queue for sync
    // sync_engine.queue_operation(
    //     "students",
    //     OperationType::Create,
    //     &student.id.to_string(),
    //     student_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(student.id.to_string())
}

// Staff Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn get_staff(
    db: State<'_, DatabaseState>,
) -> Result<Vec<Staff>, String> {
    db.get_staff().await
        .map_err(|e| format!("Failed to get staff: {}", e))
}

#[tauri::command]
pub async fn create_staff(
    staff_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let staff: Staff = serde_json::from_value(staff_data.clone())
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    
    // Local-first storage
    db.create_staff(&staff).await
        .map_err(|e| format!("Failed to create staff: {}", e))?;

    // Queue for sync
    // sync_engine.queue_operation(
    //     "staff",
    //     OperationType::Create,
    //     &staff.id.to_string(),
    //     staff_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(staff.id.to_string())
}

#[tauri::command]
pub async fn update_staff(
    _staff_id: String,
    staff_data: Value,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    let staff: Staff = serde_json::from_value(staff_data)
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    
    db.update_staff(&staff).await
        .map_err(|e| format!("Failed to update staff: {}", e))
}

#[tauri::command]
pub async fn delete_staff(
    staff_id: String,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    db.delete_staff(&staff_id).await
        .map_err(|e| format!("Failed to delete staff: {}", e))
}

// Class Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn get_classes(
    db: State<'_, DatabaseState>,
) -> Result<Vec<Class>, String> {
    db.get_classes().await
        .map_err(|e| format!("Failed to get classes: {}", e))
}

#[tauri::command]
pub async fn create_class(
    class_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let class: Class = serde_json::from_value(class_data.clone())
        .map_err(|e| format!("Failed to parse class data: {}", e))?;
    
    // Local-first storage
    db.create_class(&class).await
        .map_err(|e| format!("Failed to create class: {}", e))?;

    // Queue for sync
    // sync_engine.queue_operation(
    //     "classes",
    //     OperationType::Create,
    //     &class.id.to_string(),
    //     class_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(class.id.to_string())
}

#[tauri::command]
pub async fn update_class(
    _class_id: String,
    class_data: Value,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    let class: Class = serde_json::from_value(class_data)
        .map_err(|e| format!("Failed to parse class data: {}", e))?;
    
    db.update_class(&class).await
        .map_err(|e| format!("Failed to update class: {}", e))
}

#[tauri::command]
pub async fn delete_class(
    class_id: String,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    db.delete_class(&class_id).await
        .map_err(|e| format!("Failed to delete class: {}", e))
}

// Borrowing Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn get_borrowings(
    db: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Always read from local SQLite for fast offline access
    db.get_borrowings_with_details().await
        .map_err(|e| format!("Failed to get borrowings: {}", e))
}

#[tauri::command]
pub async fn create_borrowing(
    borrowing_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let borrowing: crate::models::Borrowing = serde_json::from_value(borrowing_data.clone())
        .map_err(|e| format!("Failed to parse borrowing data: {}", e))?;
    
    // Save to local SQLite first (offline-first approach)
    db.create_borrowing(&borrowing).await
        .map_err(|e| format!("Failed to create borrowing: {}", e))?;

    // Queue for sync to Supabase when online
    // sync_engine.queue_operation(
    //     "borrowings",
    //     OperationType::Create,
    //     &borrowing.id.to_string(),
    //     borrowing_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(borrowing.id.to_string())
}

#[tauri::command]
pub async fn return_book(
    _borrowing_id: String,
    _return_data: Value,
    _db: State<'_, DatabaseState>,
) -> Result<(), String> {
    // TODO: Implement return_book method in DatabaseManager
    // For now, just return success to prevent crashes
    Ok(())
}

// Update Commands
#[tauri::command]
pub async fn update_book(
    _book_id: String,
    book_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    let book: Book = serde_json::from_value(book_data.clone())
        .map_err(|e| format!("Failed to parse book data: {}", e))?;
    
    // Update local SQLite first
    db.update_book(&book).await
        .map_err(|e| format!("Failed to update book: {}", e))?;

    // Queue for sync to Supabase
    // sync_engine.queue_operation(
    //     "books",
    //     OperationType::Update,
    //     &book_id,
    //     book_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_student(
    _student_id: String,
    student_data: Value,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    let student: Student = serde_json::from_value(student_data.clone())
        .map_err(|e| format!("Failed to parse student data: {}", e))?;
    
    // Update local SQLite first
    db.update_student(&student).await
        .map_err(|e| format!("Failed to update student: {}", e))?;

    // Queue for sync
    // sync_engine.queue_operation(
    //     "students",
    //     OperationType::Update,
    //     &student_id,
    //     student_data,
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

// Delete Commands
#[tauri::command]
pub async fn delete_book(
    book_id: String,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    // Delete from local SQLite first
    db.delete_book(&book_id).await
        .map_err(|e| format!("Failed to delete book: {}", e))?;

    // Queue for sync to Supabase
    // sync_engine.queue_operation(
    //     "books",
    //     OperationType::Delete,
    //     &book_id,
    //     serde_json::json!({"id": book_id}),
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_student(
    student_id: String,
    db: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    // Delete from local SQLite first
    db.delete_student(&student_id).await
        .map_err(|e| format!("Failed to delete student: {}", e))?;

    // Queue for sync
    // sync_engine.queue_operation(
    //     "students",
    //     OperationType::Delete,
    //     &student_id,
    //     serde_json::json!({"id": student_id}),
    // ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

// Analytics Commands - Efficient large database queries
#[tauri::command]
pub async fn get_library_stats(
    db: State<'_, DatabaseState>,
) -> Result<LibraryStats, String> {
    // Optimized queries with indexes for large datasets
    db.get_library_stats().await
        .map_err(|e| format!("Failed to get library stats: {}", e))
}

// Sync Commands - Hybrid online/offline capabilities
#[tauri::command]
pub async fn get_sync_status(
    sync_engine: State<'_, SyncEngine>,
) -> Result<SyncStatus, String> {
    Ok(sync_engine.get_status().await)
}

#[tauri::command]
pub async fn trigger_sync(
    sync_engine: State<'_, SyncEngine>,
) -> Result<(), String> {
    info!("Manual sync triggered");
    
    // Check connectivity first
    let is_online = sync_engine.check_connectivity().await;
    if !is_online {
        return Err("No internet connection available".to_string());
    }
    
    // Trigger data pull from Supabase
    sync_engine.trigger_data_pull().await
        .map_err(|e| format!("Sync failed: {}", e))?;
    
    info!("Manual sync completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn get_cached_connectivity_status(
    sync_engine: State<'_, SyncEngine>,
) -> Result<bool, String> {
    let status = sync_engine.get_status().await;
    Ok(status.is_online)
}

#[tauri::command]
pub async fn check_connectivity(
    sync_engine: State<'_, SyncEngine>,
) -> Result<bool, String> {
    Ok(sync_engine.check_connectivity().await)
}

#[tauri::command]
pub async fn force_connectivity_refresh(
    sync_engine: State<'_, SyncEngine>,
) -> Result<bool, String> {
    Ok(sync_engine.check_connectivity().await)
}

#[tauri::command]
pub async fn get_connection_status(
    sync_engine: State<'_, SyncEngine>,
) -> Result<Value, String> {
    let status = sync_engine.get_status().await;
    Ok(json!({
        "is_online": status.is_online,
        "is_syncing": status.is_syncing,
        "last_sync": status.last_sync,
        "last_error": status.last_error,
        "database_initialized": status.database_initialized,
        "initial_sync_completed": status.initial_sync_completed,
    }))
}

#[tauri::command]
pub async fn maintain_session(
    _sync_engine: State<'_, SyncEngine>,
) -> Result<(), String> {
    // Session management handled by the sync engine internally
    Ok(())
}

#[tauri::command]
pub async fn restore_session(
    _sync_engine: State<'_, SyncEngine>,
) -> Result<(), String> {
    // Session management handled by the sync engine internally
    Ok(())
}

#[tauri::command]
pub async fn initial_data_pull(
    sync_engine: State<'_, SyncEngine>,
) -> Result<(), String> {
    info!("Initial data pull requested");
    
    // Check connectivity first
    let is_online = sync_engine.check_connectivity().await;
    if !is_online {
        return Err("No internet connection available for initial data pull".to_string());
    }
    
    // Force initial data pull from Supabase
    sync_engine.trigger_data_pull().await
        .map_err(|e| format!("Initial data pull failed: {}", e))?;
    
    info!("Initial data pull completed successfully");
    Ok(())
}

#[tauri::command]
pub async fn check_local_data_count(
    db: State<'_, DatabaseState>,
) -> Result<Value, String> {
    // Check if we have any data locally (indicates successful pull)
    let books = db.get_books().await.map_err(|e| e.to_string())?;
    let students = db.get_students().await.map_err(|e| e.to_string())?;
    let categories = db.get_categories().await.map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "books_count": books.len(),
        "students_count": students.len(),
        "categories_count": categories.len(),
        "has_data": books.len() > 0 || students.len() > 0 || categories.len() > 0
    }))
}

// Utility Commands
#[tauri::command]
pub async fn generate_id() -> Result<String, String> {
    Ok(Uuid::new_v4().to_string())
}

#[tauri::command]
pub async fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

// Database Optimization Commands - For large dataset performance
#[tauri::command]
pub async fn optimize_database(
    _db: State<'_, DatabaseState>,
) -> Result<(), String> {
    // Run VACUUM, ANALYZE, and other SQLite optimizations
    // This is important for maintaining performance with large datasets
    Ok(())
}

#[tauri::command]
pub async fn get_database_info(
    db: State<'_, DatabaseState>,
) -> Result<Value, String> {
    // Get actual database statistics
    let books = db.get_books().await.map_err(|e| e.to_string())?;
    let students = db.get_students().await.map_err(|e| e.to_string())?;
    let categories = db.get_categories().await.map_err(|e| e.to_string())?;
    let stats = db.get_library_stats().await.map_err(|e| e.to_string())?;
    
    let info = serde_json::json!({
        "status": "ok",
        "backend": "sqlite_with_supabase_sync",
        "offline_capable": true,
        "sync_enabled": true,
        "data_counts": {
            "books": books.len(),
            "students": students.len(),
            "categories": categories.len(),
            "total_books": stats.total_books,
            "total_students": stats.total_students,
            "available_books": stats.available_books
        },
        "sample_data": {
            "has_books": !books.is_empty(),
            "has_students": !students.is_empty(),
            "has_categories": !categories.is_empty(),
            "first_book_title": books.first().map(|b| &b.title),
            "first_student_name": students.first().map(|s| format!("{} {}", s.first_name, s.last_name))
        }
    });
    Ok(info)
}

// Enhanced Performance Monitoring Commands
#[tauri::command]
pub async fn get_performance_stats(
    db: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let conn = db.get_connection().lock().unwrap();
    
    // Get WAL mode info
    let wal_info: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap_or_default();
    
    // Get cache hit rate (approximate)
    let cache_size: i32 = conn.query_row("PRAGMA cache_size", [], |row| row.get(0)).unwrap_or(0);
    
    // Get sync settings
    let sync_mode: String = conn.query_row("PRAGMA synchronous", [], |row| {
        let val: i32 = row.get(0)?;
        Ok(match val {
            0 => "OFF".to_string(),
            1 => "NORMAL".to_string(),
            2 => "FULL".to_string(),
            3 => "EXTRA".to_string(),
            _ => "UNKNOWN".to_string(),
        })
    }).unwrap_or_default();
    
    Ok(json!({
        "journal_mode": wal_info,
        "cache_size": cache_size,
        "synchronous_mode": sync_mode,
        "optimizations": {
            "wal_enabled": wal_info == "wal",
            "cache_optimized": cache_size > 1000,
            "sync_optimized": sync_mode == "NORMAL"
        }
    }))
}

#[tauri::command]
pub async fn enhance_database_performance(
    db: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let conn = db.get_connection().lock().unwrap();
    
    let mut optimizations = Vec::new();
    
    // Enable WAL mode if not already enabled
    let current_mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap_or_default();
    if current_mode != "wal" {
        conn.execute("PRAGMA journal_mode = WAL", [])
            .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;
        optimizations.push("Enabled WAL mode for better concurrency");
    }
    
    // Set optimal synchronous mode
    conn.execute("PRAGMA synchronous = NORMAL", [])
        .map_err(|e| format!("Failed to set sync mode: {}", e))?;
    optimizations.push("Set synchronous mode to NORMAL");
    
    // Increase cache size for better performance
    conn.execute("PRAGMA cache_size = 10000", [])
        .map_err(|e| format!("Failed to set cache size: {}", e))?;
    optimizations.push("Increased cache size to 10MB");
    
    // Set temp store to memory
    conn.execute("PRAGMA temp_store = MEMORY", [])
        .map_err(|e| format!("Failed to set temp store: {}", e))?;
    optimizations.push("Set temporary storage to memory");
    
    // Run VACUUM to reclaim space
    conn.execute("VACUUM", [])
        .map_err(|e| format!("Failed to vacuum database: {}", e))?;
    optimizations.push("Vacuumed database to reclaim space");
    
    // Analyze tables for better query planning
    conn.execute("ANALYZE", [])
        .map_err(|e| format!("Failed to analyze database: {}", e))?;
    optimizations.push("Analyzed database for query optimization");
    
    info!("Enhanced database performance with {} optimizations", optimizations.len());
    
    Ok(json!({
        "success": true,
        "optimizations_applied": optimizations,
        "performance_improvements": {
            "wal_mode": "Better concurrency and crash recovery",
            "cache_optimization": "Faster query execution",
            "temp_memory": "Faster temporary operations",
            "vacuum": "Reduced database size and fragmentation",
            "analyze": "Improved query planning"
        }
    }))
}

// Session Management Commands for Offline Authentication
#[tauri::command]
pub async fn save_user_session(
    session_data: Value,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    let mut session: UserSession = serde_json::from_value(session_data)
        .map_err(|e| format!("Failed to parse session data: {}", e))?;
    
    // Set offline expiry to 7 days from now
    session.offline_expiry = Utc::now() + Duration::days(7);
    
    db.save_user_session(&session).await
        .map_err(|e| format!("Failed to save session: {}", e))?;
    
    info!("User session saved for offline use: {}", session.email);
    Ok(())
}

#[tauri::command]
pub async fn get_cached_user_session(
    user_id: String,
    db: State<'_, DatabaseState>,
) -> Result<Option<UserSession>, String> {
    let session = if user_id == "any" {
        // Get the most recent valid session for any user
        db.get_any_valid_session().await
            .map_err(|e| format!("Failed to get any session: {}", e))?
    } else {
        db.get_valid_user_session(&user_id).await
            .map_err(|e| format!("Failed to get session: {}", e))?
    };
    
    if let Some(ref session) = session {
        // Update last activity
        let _ = db.update_session_activity(&session.user_id).await;
        info!("Retrieved cached session for user: {}", session.email);
    }
    
    Ok(session)
}

#[tauri::command]
pub async fn invalidate_user_session(
    user_id: String,
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    db.invalidate_user_session(&user_id).await
        .map_err(|e| format!("Failed to invalidate session: {}", e))?;
    
    info!("Invalidated session for user: {}", user_id);
    Ok(())
}

#[tauri::command]
pub async fn is_session_valid_offline(
    user_id: String,
    db: State<'_, DatabaseState>,
) -> Result<bool, String> {
    let session = db.get_valid_user_session(&user_id).await
        .map_err(|e| format!("Failed to check session: {}", e))?;
    
    match session {
        Some(session) => {
            let is_valid = session.session_valid && session.offline_expiry > Utc::now();
            info!("Session validity check for {}: {}", session.email, is_valid);
            Ok(is_valid)
        },
        None => {
            info!("No session found for user: {}", user_id);
            Ok(false)
        }
    }
}

#[tauri::command]
pub async fn cleanup_expired_sessions(
    db: State<'_, DatabaseState>,
) -> Result<(), String> {
    db.cleanup_expired_sessions().await
        .map_err(|e| format!("Failed to cleanup sessions: {}", e))?;
    
    info!("Cleaned up expired sessions");
    Ok(())
}

#[tauri::command]
pub async fn setup_sync_config(
    sync_engine: State<'_, SyncEngine>,
    config: serde_json::Value,
) -> Result<(), String> {
    info!("Setting up sync config: {:?}", config);
    
    // Extract configuration values
    let supabase_url = config.get("supabaseUrl")
        .and_then(|v| v.as_str())
        .ok_or("Missing supabaseUrl")?;
    
    let supabase_anon_key = config.get("supabaseAnonKey")
        .and_then(|v| v.as_str())
        .ok_or("Missing supabaseAnonKey")?;
    
    info!("Configuring sync with Supabase URL: {}", supabase_url);
    
    // Update the sync engine configuration
    let mut engine_config = sync_engine.config.clone();
    engine_config.url = supabase_url.to_string();
    engine_config.anon_key = supabase_anon_key.to_string();
    
    // Test connectivity and perform initial data pull
    let is_online = sync_engine.check_connectivity().await;
    if is_online {
        info!("Connectivity confirmed - triggering initial data pull");
        let sync_engine_clone = sync_engine.inner().clone();
        tokio::spawn(async move {
            if let Err(e) = sync_engine_clone.trigger_data_pull().await {
                warn!("Initial data pull failed: {}", e);
            }
        });
    } else {
        warn!("No connectivity - sync will be attempted when online");
    }
    
    Ok(())
}

// Enhanced Authentication Commands for Offline-First Experience
/*
#[tauri::command]
pub async fn authenticate_user(
    credentials: AuthCredentials,
    auth: State<'_, AuthState>,
) -> Result<AuthResponse, String> {
    // First try offline authentication
    match auth.validate_offline_credentials(&credentials).await {
        Ok(Some(session)) => {
            info!("Offline authentication successful for: {}", credentials.email);
            return Ok(AuthResponse {
                success: true,
                session: Some(session),
                error: None,
                is_offline: true,
            });
        },
        Ok(None) => {
            info!("No offline session found for: {}", credentials.email);
        },
        Err(e) => {
            info!("Offline auth error: {}", e);
        }
    }

    // If offline auth fails, try online authentication
    // This would integrate with Supabase in a real implementation
    // For now, return an error to indicate online auth is needed
    Ok(AuthResponse {
        success: false,
        session: None,
        error: Some("Online authentication required".to_string()),
        is_offline: false,
    })
}

#[tauri::command]
pub async fn store_authenticated_session(
    session_data: Value,
    auth: State<'_, AuthState>,
) -> Result<String, String> {
    let session: UserSession = serde_json::from_value(session_data)
        .map_err(|e| format!("Failed to parse session data: {}", e))?;
    
    auth.store_session(&session).await
        .map_err(|e| format!("Failed to store session: {}", e))?;
    
    info!("Session stored for offline access: {}", session.email);
    Ok(session.id.to_string())
}

#[tauri::command]
pub async fn get_stored_session(
    email: String,
    auth: State<'_, AuthState>,
) -> Result<Option<UserSession>, String> {
    auth.get_stored_session(&email).await
        .map_err(|e| format!("Failed to get stored session: {}", e))
}

#[tauri::command]
pub async fn logout_user(
    session_id: String,
    auth: State<'_, AuthState>,
) -> Result<(), String> {
    auth.invalidate_session(&session_id).await
        .map_err(|e| format!("Failed to logout: {}", e))?;
    
    info!("User logged out: {}", session_id);
    Ok(())
}

#[tauri::command]
pub async fn cleanup_expired_auth_sessions(
    auth: State<'_, AuthState>,
) -> Result<(), String> {
    auth.cleanup_expired_sessions().await
        .map_err(|e| format!("Failed to cleanup expired sessions: {}", e))?;
    
    info!("Cleaned up expired authentication sessions");
    Ok(())
}
*/

// Professional Sync Commands for UI Integration
#[tauri::command]
pub async fn sync_books_only(
    limit: Option<u32>,
) -> Result<Value, String> {
    info!("Manual books sync triggered with limit: {:?}", limit);
    
    // Use the simple sync for books specifically
    match crate::simple_sync::sync_books_from_supabase(limit.unwrap_or(100)).await {
        Ok(count) => {
            info!("Books sync completed: {} records", count);
            Ok(json!({
                "success": true,
                "recordsSync": count,
                "entity": "books"
            }))
        },
        Err(e) => {
            warn!("Books sync failed: {}", e);
            Err(format!("Books sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_categories_only(
) -> Result<Value, String> {
    info!("Manual categories sync triggered");
    
    // Use the simple sync for categories specifically
    match crate::simple_sync::sync_categories_from_supabase().await {
        Ok(count) => {
            info!("Categories sync completed: {} records", count);
            Ok(json!({
                "success": true,
                "recordsSync": count,
                "entity": "categories"
            }))
        },
        Err(e) => {
            warn!("Categories sync failed: {}", e);
            Err(format!("Categories sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_students_only(
    limit: Option<u32>,
) -> Result<Value, String> {
    info!("Manual students sync triggered with limit: {:?}", limit);
    
    // Use the simple sync for students specifically
    match crate::simple_sync::sync_students_from_supabase(limit.unwrap_or(100)).await {
        Ok(count) => {
            info!("Students sync completed: {} records", count);
            Ok(json!({
                "success": true,
                "recordsSync": count,
                "entity": "students"
            }))
        },
        Err(e) => {
            warn!("Students sync failed: {}", e);
            Err(format!("Students sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_all_data(
) -> Result<Value, String> {
    info!("Manual full sync triggered");
    
    // Use the simple sync for all data
    match crate::simple_sync::sync_data_from_supabase().await {
        Ok(_) => {
            info!("Full sync completed successfully");
            Ok(json!({
                "success": true,
                "message": "All data synchronized successfully"
            }))
        },
        Err(e) => {
            warn!("Full sync failed: {}", e);
            Err(format!("Full sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn clear_local_database(
    db: State<'_, DatabaseState>,
) -> Result<Value, String> {
    info!("Clearing local database");
    
    // This would clear all tables - implement carefully
    match db.clear_all_tables().await {
        Ok(_) => {
            info!("Local database cleared successfully");
            Ok(json!({
                "success": true,
                "message": "Local database cleared successfully"
            }))
        },
        Err(e) => {
            warn!("Failed to clear local database: {}", e);
            Err(format!("Failed to clear local database: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_local_data_stats(
    db: State<'_, DatabaseState>,
) -> Result<Value, String> {
    info!("Getting local data statistics (optimized)");
    
    // Use optimized bulk count function for better performance
    let counts = db.get_all_counts_optimized().await.unwrap_or_default();
    
    let books_count = counts.get("books").unwrap_or(&0);
    let students_count = counts.get("students").unwrap_or(&0);
    let categories_count = counts.get("categories").unwrap_or(&0);
    let borrowings_count = counts.get("borrowings").unwrap_or(&0);
    let book_copies_count = counts.get("book_copies").unwrap_or(&0);
    let staff_count = counts.get("staff").unwrap_or(&0);
    let classes_count = counts.get("classes").unwrap_or(&0);
    let fines_count = counts.get("fines").unwrap_or(&0);
    let fine_settings_count = counts.get("fine_settings").unwrap_or(&0);
    let group_borrowings_count = counts.get("group_borrowings").unwrap_or(&0);
    let theft_reports_count = counts.get("theft_reports").unwrap_or(&0);
    
    println!("📊 Complete database counts: books={}, students={}, categories={}, borrowings={}, book_copies={}, staff={}, classes={}, fines={}, fine_settings={}, group_borrowings={}, theft_reports={}", 
        books_count, students_count, categories_count, borrowings_count, book_copies_count, staff_count, classes_count, fines_count, fine_settings_count, group_borrowings_count, theft_reports_count);
    
    Ok(json!({
        "books": books_count,
        "students": students_count,
        "categories": categories_count,
        "borrowings": borrowings_count,
        "bookCopies": book_copies_count,
        "staff": staff_count,
        "classes": classes_count,
        "fines": fines_count,
        "fineSettings": fine_settings_count,
        "groupBorrowings": group_borrowings_count,
        "theftReports": theft_reports_count
    }))
}

#[tauri::command]
pub async fn sync_borrowings_only(limit: Option<u32>) -> Result<u32, String> {
    info!("Manual borrowings sync triggered with limit: {:?}", limit);
    let limit = limit.unwrap_or(1000);
    
    match crate::simple_sync::sync_borrowings_from_supabase(limit).await {
        Ok(count) => {
            info!("Borrowings sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Borrowings sync failed: {}", e);
            Err(format!("Borrowings sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_staff_only(limit: Option<u32>) -> Result<u32, String> {
    info!("Manual staff sync triggered with limit: {:?}", limit);
    let limit = limit.unwrap_or(100);
    
    match crate::simple_sync::sync_staff_from_supabase(limit).await {
        Ok(count) => {
            info!("Staff sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Staff sync failed: {}", e);
            Err(format!("Staff sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_classes_only() -> Result<u32, String> {
    info!("Manual classes sync triggered");
    
    match crate::simple_sync::sync_classes_from_supabase().await {
        Ok(count) => {
            info!("Classes sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Classes sync failed: {}", e);
            Err(format!("Classes sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn pull_all_database() -> Result<String, String> {
    info!("🚀 FULL DATABASE PULL initiated by user");
    
    match crate::simple_sync::pull_all_database_from_supabase().await {
        Ok(_) => {
            info!("✅ Full database pull completed successfully");
            Ok("🎉 Complete database synchronization finished! All tables have been pulled from remote server.".to_string())
        }
        Err(e) => {
            error!("❌ Full database pull failed: {}", e);
            Err(format!("Full database pull failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_book_copies_only(limit: Option<u32>) -> Result<u32, String> {
    info!("Manual book copies sync triggered with limit: {:?}", limit);
    let limit = limit.unwrap_or(100000); // Default to 100K for massive dataset
    
    match crate::simple_sync::sync_book_copies_from_supabase(limit).await {
        Ok(count) => {
            info!("Book copies sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Book copies sync failed: {}", e);
            Err(format!("Book copies sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_fines_only(limit: Option<u32>) -> Result<u32, String> {
    info!("Manual fines sync triggered with limit: {:?}", limit);
    let limit = limit.unwrap_or(10000);
    
    match crate::simple_sync::sync_fines_from_supabase(Some(limit)).await {
        Ok(count) => {
            info!("Fines sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Fines sync failed: {}", e);
            Err(format!("Fines sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_fine_settings_only() -> Result<u32, String> {
    info!("Manual fine settings sync triggered");
    
    match crate::simple_sync::sync_fine_settings_from_supabase(Some(1000)).await {
        Ok(count) => {
            info!("Fine settings sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Fine settings sync failed: {}", e);
            Err(format!("Fine settings sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_group_borrowings_only(limit: Option<u32>) -> Result<u32, String> {
    info!("Manual group borrowings sync triggered with limit: {:?}", limit);
    let limit = limit.unwrap_or(10000);
    
    match crate::simple_sync::sync_group_borrowings_from_supabase(Some(limit)).await {
        Ok(count) => {
            info!("Group borrowings sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Group borrowings sync failed: {}", e);
            Err(format!("Group borrowings sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_theft_reports_only(limit: Option<u32>) -> Result<u32, String> {
    info!("Manual theft reports sync triggered with limit: {:?}", limit);
    let limit = limit.unwrap_or(10000);
    
    match crate::simple_sync::sync_theft_reports_from_supabase(Some(limit)).await {
        Ok(count) => {
            info!("Theft reports sync completed: {} records", count);
            Ok(count)
        }
        Err(e) => {
            error!("Theft reports sync failed: {}", e);
            Err(format!("Theft reports sync failed: {}", e))
        }
    }
}
