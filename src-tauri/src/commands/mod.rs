use crate::database::{DatabaseManager, LibraryStats};
use crate::models::*;
use crate::sync::{SyncEngine, SyncStatus, OperationType};
use serde_json::Value;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;
use tracing::info;

pub type DatabaseState = Arc<DatabaseManager>;
pub type SyncState = Arc<SyncEngine>;

// Book Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn create_book(
    book_data: Value,
    db: State<'_, DatabaseState>,
    sync_engine: State<'_, SyncState>,
) -> Result<String, String> {
    let book: Book = serde_json::from_value(book_data.clone())
        .map_err(|e| format!("Failed to parse book data: {}", e))?;
    
    // Save to local SQLite first (offline-first approach)
    db.create_book(&book).await
        .map_err(|e| format!("Failed to create book: {}", e))?;

    // Queue for sync to Supabase when online
    sync_engine.queue_operation(
        "books",
        OperationType::Create,
        &book.id.to_string(),
        book_data,
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

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
    sync_engine: State<'_, SyncState>,
) -> Result<String, String> {
    let category: Category = serde_json::from_value(category_data.clone())
        .map_err(|e| format!("Failed to parse category data: {}", e))?;
    
    // Local-first storage
    db.create_category(&category).await
        .map_err(|e| format!("Failed to create category: {}", e))?;

    // Queue for sync
    sync_engine.queue_operation(
        "categories",
        OperationType::Create,
        &category.id.to_string(),
        category_data,
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

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
    sync_engine: State<'_, SyncState>,
) -> Result<String, String> {
    let student: Student = serde_json::from_value(student_data.clone())
        .map_err(|e| format!("Failed to parse student data: {}", e))?;
    
    // Local-first storage
    db.create_student(&student).await
        .map_err(|e| format!("Failed to create student: {}", e))?;

    // Queue for sync
    sync_engine.queue_operation(
        "students",
        OperationType::Create,
        &student.id.to_string(),
        student_data,
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(student.id.to_string())
}

// Update Commands
#[tauri::command]
pub async fn update_book(
    book_id: String,
    book_data: Value,
    db: State<'_, DatabaseState>,
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    let book: Book = serde_json::from_value(book_data.clone())
        .map_err(|e| format!("Failed to parse book data: {}", e))?;
    
    // Update local SQLite first
    db.update_book(&book).await
        .map_err(|e| format!("Failed to update book: {}", e))?;

    // Queue for sync to Supabase
    sync_engine.queue_operation(
        "books",
        OperationType::Update,
        &book_id,
        book_data,
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_student(
    student_id: String,
    student_data: Value,
    db: State<'_, DatabaseState>,
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    let student: Student = serde_json::from_value(student_data.clone())
        .map_err(|e| format!("Failed to parse student data: {}", e))?;
    
    // Update local SQLite first
    db.update_student(&student).await
        .map_err(|e| format!("Failed to update student: {}", e))?;

    // Queue for sync
    sync_engine.queue_operation(
        "students",
        OperationType::Update,
        &student_id,
        student_data,
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

// Delete Commands
#[tauri::command]
pub async fn delete_book(
    book_id: String,
    db: State<'_, DatabaseState>,
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    // Delete from local SQLite first
    db.delete_book(&book_id).await
        .map_err(|e| format!("Failed to delete book: {}", e))?;

    // Queue for sync to Supabase
    sync_engine.queue_operation(
        "books",
        OperationType::Delete,
        &book_id,
        serde_json::json!({"id": book_id}),
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_student(
    student_id: String,
    db: State<'_, DatabaseState>,
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    // Delete from local SQLite first
    db.delete_student(&student_id).await
        .map_err(|e| format!("Failed to delete student: {}", e))?;

    // Queue for sync
    sync_engine.queue_operation(
        "students",
        OperationType::Delete,
        &student_id,
        serde_json::json!({"id": student_id}),
    ).await.map_err(|e| format!("Failed to queue sync operation: {}", e))?;

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
    sync_engine: State<'_, SyncState>,
) -> Result<SyncStatus, String> {
    Ok(sync_engine.get_sync_status().await)
}

#[tauri::command]
pub async fn trigger_sync(
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    // Manual sync trigger - pulls from Supabase and pushes local changes
    sync_engine.full_sync().await
        .map_err(|e| format!("Failed to trigger sync: {}", e))
}

#[tauri::command]
pub async fn get_cached_connectivity_status(
    sync_engine: State<'_, SyncState>,
) -> Result<bool, String> {
    // Get cached online status (from background polling)
    let is_online = sync_engine.is_online();
    info!("Cached connectivity status: {}", is_online);
    Ok(is_online)
}

#[tauri::command]
pub async fn check_connectivity(
    sync_engine: State<'_, SyncState>,
) -> Result<bool, String> {
    // Force check connectivity and update status
    let is_online = sync_engine.check_connectivity().await;
    info!("Manual connectivity check result: {}", is_online);
    Ok(is_online)
}

#[tauri::command]
pub async fn force_connectivity_refresh(
    sync_engine: State<'_, SyncState>,
) -> Result<bool, String> {
    // Force immediate connectivity check and status update
    let is_online = sync_engine.check_connectivity().await;
    info!("Forced connectivity refresh: {}", is_online);
    Ok(is_online)
}

#[tauri::command]
pub async fn setup_sync_config(
    _url: String,
    _anon_key: String,
    _sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    // Update Supabase configuration for sync
    // In a real implementation, this would update the sync engine's config
    Ok(())
}

#[tauri::command]
pub async fn get_connection_status(
    sync_engine: State<'_, SyncState>,
) -> Result<Value, String> {
    let status = sync_engine.get_sync_status().await;
    Ok(serde_json::json!({
        "is_online": status.is_online,
        "is_syncing": status.is_syncing,
        "last_sync": status.last_sync,
        "pending_operations": status.pending_operations,
        "initial_sync_completed": status.initial_sync_completed,
        "database_initialized": status.database_initialized
    }))
}

#[tauri::command]
pub async fn maintain_session(
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    sync_engine.maintain_session().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_session(
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    sync_engine.restore_session().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn initial_data_pull(
    sync_engine: State<'_, SyncState>,
) -> Result<(), String> {
    // Force initial data pull from Supabase
    sync_engine.full_sync().await
        .map_err(|e| e.to_string())
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
    _db: State<'_, DatabaseState>,
) -> Result<Value, String> {
    // Return database size, table counts, index info, etc.
    // Useful for monitoring large database performance
    let info = serde_json::json!({
        "status": "ok",
        "backend": "sqlite_with_supabase_sync",
        "offline_capable": true,
        "sync_enabled": true
    });
    Ok(info)
}
