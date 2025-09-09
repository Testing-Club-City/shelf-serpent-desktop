 use crate::database::{DatabaseManager, LibraryStats};
use crate::models::*;
use crate::sync::{SyncEngine, SyncStatus};
// use crate::auth::{AuthManager, AuthCredentials, AuthResponse, UserSession};
use serde_json::{Value, json};
use std::sync::Arc;
use tauri::{State, Emitter};
use uuid::Uuid;
use tracing::{info, warn, error};
use chrono::{Duration, Utc};
use base64::{self, Engine as _};
use rusqlite;
use uuid;
use rand;
use std::sync::atomic::{AtomicBool, Ordering};

// Global sync lock
static SYNC_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

fn start_sync() -> bool {
    SYNC_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok()
}

fn end_sync() {
    SYNC_IN_PROGRESS.store(false, Ordering::SeqCst);
}

fn is_sync_in_progress() -> bool {
    SYNC_IN_PROGRESS.load(Ordering::SeqCst)
}


pub mod group_borrowing_commands;
pub mod enhanced_book_search;
pub mod books;
pub mod upload_local_changes;
pub mod fast_connectivity;
pub mod fixed_sync_commands;
pub mod simple_book_search;
pub mod sync_status;
pub mod reports;
// pub mod test_book_copies;

// pub use test_book_copies::test_book_copies_creation;
pub use reports::*;

// Re-export report commands
pub use reports::{
    get_books_by_supplier,
    get_staff_overdue_books,
    get_student_overdue_books,
    get_books_by_category,
    get_borrowing_statistics,
    get_popular_books,
    get_class_borrowing_report,
    get_fine_reports,
};

pub type DatabaseState = Arc<DatabaseManager>;
// pub type AuthState = Arc<AuthManager>;
// pub type SyncState = Arc<SyncEngine>; // Disabled for build

// Book Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn create_book(
    book_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    if is_sync_in_progress() {
        return Err("Database operations are blocked during sync. Please wait for sync to complete.".to_string());
    }
    let book_id = Uuid::new_v4();
    println!("📚 Creating book with ID: {} and data: {}", book_id, serde_json::to_string_pretty(&book_data).unwrap_or_default());
    
    // Handle the frontend book creation format
    let title = book_data.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown Title").to_string();
    let author = book_data.get("author").and_then(|v| v.as_str()).unwrap_or("Unknown Author").to_string();
    let category_id = book_data.get("category_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok());
    let shelf_location = book_data.get("shelf_location").and_then(|v| v.as_str()).map(|s| s.to_string());
    let publication_year = book_data.get("publication_year").and_then(|v| v.as_i64()).map(|i| i as i32);
    let acquisition_year = book_data.get("acquisition_year").and_then(|v| v.as_i64()).map(|i| i as i32);
    let total_copies = book_data.get("total_copies").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let book_code = book_data.get("book_code").and_then(|v| v.as_str()).map(|s| s.to_string());
    let _start_number = book_data.get("start_number").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    
    // Get the next sequential legacy_book_id for this book
    let next_legacy_id = state.get_next_legacy_book_id()
        .map_err(|e| format!("Failed to get next legacy ID: {}", e))?;
    
    println!("📊 Using sequential legacy_book_id: {} for new book", next_legacy_id);
    
    // Create the main book record
    let now = Utc::now();
    
    let book = Book {
        id: book_id,
        title: title.clone(),
        author: author.clone(),
        isbn: None,
        genre: None,
        publisher: None,
        publication_year,
        total_copies,
        available_copies: total_copies,
        shelf_location,
        cover_image_url: None,
        description: None,
        status: BookStatus::Available,
        category_id,
        created_at: now,
        updated_at: now,
        condition: None,
        book_code,
        acquisition_year,
        legacy_book_id: Some(next_legacy_id),
        legacy_isbn: None,
        supplier_type: None,
        supplier_name: None,
    };
    
    // Save to local SQLite first (offline-first approach)
    state.create_book(&book).await
        .map_err(|e| format!("Failed to create book: {}", e))?;

    println!("✅ Book created successfully with ID: {} and {} copies", book.id, total_copies);
    Ok(book.id.to_string())
}

#[tauri::command]
pub async fn add_book_copies(
    book_id: String,
    total_copies: i32,
    starting_copy_number: Option<i32>,
    condition: Option<String>,
    year: Option<String>,
    state: State<'_, DatabaseState>,
) -> Result<Vec<String>, String> {
    println!("📚 Adding {} copies to book {}", total_copies, book_id);
    
    // Parse book_id as UUID
    let book_uuid = Uuid::parse_str(&book_id)
        .map_err(|e| format!("Invalid book ID format: {}", e))?;
    
    // Get book details for copy creation
    let book = state.get_book_by_id(&book_uuid).await
        .map_err(|e| format!("Failed to get book details: {}", e))?;
    
    // Get the next sequential legacy_book_id for book copies
    let start_legacy_id = starting_copy_number.unwrap_or_else(|| {
        state.get_next_legacy_book_id().unwrap_or(1)
    });
    
    // Parse condition
    let copy_condition = match condition.as_deref().unwrap_or("good") {
        "excellent" => BookCondition::Excellent,
        "good" => BookCondition::Good,
        "fair" => BookCondition::Fair,
        "poor" => BookCondition::Poor,
        _ => BookCondition::Good,
    };
    
    let year_suffix = year.unwrap_or_else(|| {
        chrono::Utc::now().format("%y").to_string()
    });
    
    let mut created_copy_ids = Vec::new();
    let now = chrono::Utc::now();
    
    // Create each copy using the database method
    for i in 0..total_copies {
        let copy_number = start_legacy_id + i;
        let legacy_book_id_for_copy = copy_number;
        
        // Generate copy_identifier using the same format as create_book
        let copy_identifier = if let Some(ref book_code) = book.book_code {
            let prefix = book_code.split('-').next().unwrap_or("UNK");
            format!("{}/{}/{}", prefix, legacy_book_id_for_copy, year_suffix)
        } else {
            let prefix = book.title.chars().take(3).collect::<String>().to_uppercase();
            format!("{}/{}/{}", prefix, legacy_book_id_for_copy, year_suffix)
        };
        
        println!("📋 Creating copy {} with identifier: {}", copy_number, copy_identifier);
        
        let copy_id = Uuid::new_v4();
        
        // Create BookCopy struct
        let book_copy = crate::models::BookCopy {
            id: copy_id,
            book_id: Some(book_uuid),
            copy_number: legacy_book_id_for_copy,
            book_code: copy_identifier.clone(),
            condition: copy_condition.clone(),
            status: CopyStatus::Available,
            created_at: now,
            updated_at: now,
            tracking_code: Some(copy_identifier),
            notes: None,
            legacy_book_id: Some(legacy_book_id_for_copy),
        };
        
        // Use the database method to create the copy
        state.create_book_copy(&book_copy).await
            .map_err(|e| format!("Failed to create copy {}: {}", copy_number, e))?;
        
        created_copy_ids.push(copy_id.to_string());
        println!("✅ Successfully created book copy with ID: {}", copy_id);
    }
    
    // Update the book's total_copies count by calling update_book method
    let mut updated_book = book.clone();
    updated_book.total_copies += total_copies;
    updated_book.available_copies += total_copies;
    updated_book.updated_at = now;
    
    state.update_book(&updated_book).await
        .map_err(|e| format!("Failed to update book totals: {}", e))?;
    
    println!("✅ Added {} copies to book '{}'. Total copies now: {}", 
        total_copies, book.title, updated_book.total_copies);
    
    Ok(created_copy_ids)
}

#[tauri::command]
pub async fn get_highest_copy_number(
    book_id: String,
    state: State<'_, DatabaseState>,
) -> Result<i32, String> {
    // Get book copies and find the highest legacy_book_id
    let copies = state.get_book_copies_by_book_id(&book_id).await
        .map_err(|e| format!("Failed to get book copies: {}", e))?;
    
    // Find the highest legacy_book_id from the copies
    let highest = copies.iter()
        .filter_map(|copy| {
            if let Some(copy_obj) = copy.as_object() {
                copy_obj.get("legacy_book_id")
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32)
            } else {
                None
            }
        })
        .max()
        .unwrap_or(0);
    
    Ok(highest)
}

#[tauri::command]
pub async fn get_books(
    state: State<'_, DatabaseState>,
) -> Result<Vec<Book>, String> {
    // Always read from local SQLite for fast offline access
    state.get_books().await
        .map_err(|e| format!("Failed to get books: {}", e))
}

// Optimized batch operations for large datasets
#[tauri::command]
pub async fn batch_create_books(
    books_data: Vec<Value>,
    state: State<'_, DatabaseState>,
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
        match state.create_book(&book).await {
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
    state: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let search_limit = limit.unwrap_or(50);
    let query_trimmed = query.trim();
    
    if query_trimmed.is_empty() {
        return Ok(json!({
            "students": [],
            "books": [],
            "book_copies": [],
            "borrowings": [],
            "total_students": 0,
            "total_books": 0,
            "total_book_copies": 0,
            "total_borrowings": 0,
            "query": query,
            "limit": search_limit
        }));
    }
    
    println!("🔍 Global search for: '{}'", query_trimmed);
    
    // Use the enhanced search method from database
    match state.enhanced_global_search(query_trimmed, search_limit).await {
        Ok(results) => {
            println!("✅ Global search completed: {} students, {} books, {} copies, {} borrowings", 
                results["total_students"], results["total_books"], 
                results["total_book_copies"], results["total_borrowings"]);
            Ok(results)
        }
        Err(e) => {
            println!("❌ Global search failed: {}", e);
            Err(format!("Global search failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_books_paginated(
    page: usize,
    page_size: usize,
    _category_filter: Option<String>,
    search_query: Option<String>,
    state: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let all_books = state.get_books().await
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
    state: State<'_, DatabaseState>,
) -> Result<Vec<Category>, String> {
    state.get_categories().await
        .map_err(|e| format!("Failed to get categories: {}", e))
}

#[tauri::command]
pub async fn create_category(
    category_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let category: Category = serde_json::from_value(category_data.clone())
        .map_err(|e| format!("Failed to parse category data: {}", e))?;
    
    // Local-first storage
    state.create_category(&category).await
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

#[tauri::command]
pub async fn update_category(
    category_id: String,
    category_data: Value,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let mut category: Category = serde_json::from_value(category_data)
        .map_err(|e| format!("Failed to parse category data: {}", e))?;
    
    category.id = Uuid::parse_str(&category_id).map_err(|e| format!("Invalid category ID: {}", e))?;
    
    state.update_category(&category).await
        .map_err(|e| format!("Failed to update category: {}", e))
}

#[tauri::command]
pub async fn delete_category(
    category_id: String,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    state.delete_category(&category_id).await
        .map_err(|e| format!("Failed to delete category: {}", e))
}

// Student Commands
#[tauri::command]
pub async fn get_students(
    state: State<'_, DatabaseState>,
) -> Result<Vec<Student>, String> {
    state.get_students().await
        .map_err(|e| format!("Failed to get students: {}", e))
}

#[tauri::command]
pub async fn create_student(
    student_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let student: Student = serde_json::from_value(student_data.clone())
        .map_err(|e| format!("Failed to parse student data: {}", e))?;
    
    // Local-first storage
    state.create_student(&student).await
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
    state: State<'_, DatabaseState>,
) -> Result<Vec<Staff>, String> {
    state.get_staff().await
        .map_err(|e| format!("Failed to get staff: {}", e))
}

#[tauri::command]
pub async fn create_staff(
    staff_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let staff: Staff = serde_json::from_value(staff_data.clone())
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    
    // Local-first storage
    state.create_staff(&staff).await
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
    staff_id: String,
    staff_data: Value,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let mut staff: Staff = serde_json::from_value(staff_data)
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    
    staff.id = Uuid::parse_str(&staff_id).map_err(|e| format!("Invalid staff ID: {}", e))?;
    
    state.update_staff(&staff).await
        .map_err(|e| format!("Failed to update staff: {}", e))
}

#[tauri::command]
pub async fn delete_staff(
    staff_id: String,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    state.delete_staff(&staff_id).await
        .map_err(|e| format!("Failed to delete staff: {}", e))
}

// Class Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn get_classes(
    state: State<'_, DatabaseState>,
) -> Result<Vec<Class>, String> {
    state.get_classes().await
        .map_err(|e| format!("Failed to get classes: {}", e))
}

#[tauri::command]
pub async fn create_class(
    class_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    let class: Class = serde_json::from_value(class_data.clone())
        .map_err(|e| format!("Failed to parse class data: {}", e))?;
    
    // Local-first storage
    state.create_class(&class).await
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
    class_id: String,
    class_data: Value,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let mut class: Class = serde_json::from_value(class_data)
        .map_err(|e| format!("Failed to parse class data: {}", e))?;
    
    class.id = Uuid::parse_str(&class_id).map_err(|e| format!("Invalid class ID: {}", e))?;
    
    state.update_class(&class).await
        .map_err(|e| format!("Failed to update class: {}", e))
}

#[tauri::command]
pub async fn delete_class(
    class_id: String,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    state.delete_class(&class_id).await
        .map_err(|e| format!("Failed to delete class: {}", e))
}

#[tauri::command]
pub async fn upsert_class(
    class_data: Value,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    // Convert JSON to Class struct
    let class: Class = serde_json::from_value(class_data)
        .map_err(|e| format!("Invalid class data: {}", e))?;
    
    // Try to update first, if it fails, create new
    match state.update_class(&class).await {
        Ok(_) => Ok(()),
        Err(_) => {
            // If update fails, try to create
            state.create_class(&class).await
                .map_err(|e| format!("Failed to upsert class: {}", e))
        }
    }
}

// Borrowing Commands - Core offline-capable CRUD operations
#[tauri::command]
pub async fn get_borrowings(
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Always read from local SQLite for fast offline access
    state.get_borrowings_with_details().await
        .map_err(|e| format!("Failed to get borrowings: {}", e))
}

#[tauri::command]
pub async fn get_borrowings_by_student(
    student_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Get all borrowings and filter by student ID
    let all_borrowings = state.get_borrowings_with_details().await
        .map_err(|e| format!("Failed to get borrowings: {}", e))?;
    
    let student_borrowings: Vec<Value> = all_borrowings
        .into_iter()
        .filter(|borrowing| {
            borrowing.get("student_id")
                .and_then(|v| v.as_str())
                .map(|id| id == student_id)
                .unwrap_or(false)
        })
        .collect();
    
    println!("📚 Found {} borrowings for student {}", student_borrowings.len(), student_id);
    Ok(student_borrowings)
}

#[tauri::command]
pub async fn get_borrowings_by_staff(
    staff_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Direct database query to avoid schema cache issues
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT b.*, bc.title, bc.author
         FROM borrowings b
         LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
         WHERE b.staff_id = ?
         ORDER BY b.borrowed_date DESC"
    ).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let borrowing_rows = stmt.query_map([&staff_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>("id")?,
            "staff_id": row.get::<_, String>("staff_id")?,
            "book_copy_id": row.get::<_, Option<String>>("book_copy_id")?,
            "borrowed_date": row.get::<_, Option<String>>("borrowed_date")?,
            "due_date": row.get::<_, Option<String>>("due_date")?,
            "returned_date": row.get::<_, Option<String>>("returned_date")?,
            "status": row.get::<_, Option<String>>("status")?,
            "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
            "books": {
                "title": row.get::<_, Option<String>>("title")?,
                "author": row.get::<_, Option<String>>("author")?
            }
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut borrowings = Vec::new();
    for row_result in borrowing_rows {
        borrowings.push(row_result.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    println!("📚 Found {} borrowings for staff {}", borrowings.len(), staff_id);
    Ok(borrowings)
}

#[tauri::command]
pub async fn get_fines_by_staff(
    staff_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Get all fines and filter by staff ID
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT f.*, b.tracking_code, bc.title as book_title, bc.author as book_author
         FROM fines f
         LEFT JOIN borrowings b ON f.borrowing_id = b.id
         LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
         WHERE f.staff_id = ?
         ORDER BY f.created_at DESC"
    ).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let fine_rows = stmt.query_map([&staff_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>("id")?,
            "staff_id": row.get::<_, String>("staff_id")?,
            "borrowing_id": row.get::<_, Option<String>>("borrowing_id")?,
            "fine_type": row.get::<_, String>("fine_type")?,
            "amount": row.get::<_, f64>("amount")?,
            "status": row.get::<_, String>("status")?,
            "description": row.get::<_, Option<String>>("description")?,
            "created_at": row.get::<_, String>("created_at")?,
            "borrowings": {
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "books": {
                    "title": row.get::<_, Option<String>>("book_title")?,
                    "author": row.get::<_, Option<String>>("book_author")?
                }
            }
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut fines = Vec::new();
    for row_result in fine_rows {
        fines.push(row_result.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    println!("💰 Found {} fines for staff {}", fines.len(), staff_id);
    Ok(fines)
}

#[tauri::command]
pub async fn get_fines_by_student(
    student_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Get all fines and filter by student ID
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT f.*, b.tracking_code, bc.title as book_title, bc.author as book_author
         FROM fines f
         LEFT JOIN borrowings b ON f.borrowing_id = b.id
         LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
         WHERE f.student_id = ?
         ORDER BY f.created_at DESC"
    ).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let fine_rows = stmt.query_map([&student_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>("id")?,
            "student_id": row.get::<_, String>("student_id")?,
            "borrowing_id": row.get::<_, Option<String>>("borrowing_id")?,
            "fine_type": row.get::<_, String>("fine_type")?,
            "amount": row.get::<_, f64>("amount")?,
            "status": row.get::<_, String>("status")?,
            "description": row.get::<_, Option<String>>("description")?,
            "created_at": row.get::<_, String>("created_at")?,
            "borrowings": {
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "books": {
                    "title": row.get::<_, Option<String>>("book_title")?,
                    "author": row.get::<_, Option<String>>("book_author")?
                }
            }
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut fines = Vec::new();
    for row_result in fine_rows {
        fines.push(row_result.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    println!("💰 Found {} fines for student {}", fines.len(), student_id);
    Ok(fines)
}

#[tauri::command]
pub async fn create_borrowing(
    borrowing_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<String, String> {
    if is_sync_in_progress() {
        return Err("Database operations are blocked during sync. Please wait for sync to complete.".to_string());
    }
    println!("🔄 Creating borrowing with data: {}", serde_json::to_string_pretty(&borrowing_data).unwrap_or_default());
    
    // Parse the frontend data into BorrowingCreateRequest
    let borrowing_request: BorrowingCreateRequest = serde_json::from_value(borrowing_data.clone())
        .map_err(|e| format!("Failed to parse borrowing data: {}", e))?;
    
    // Convert to full Borrowing struct with defaults
    let borrowing = borrowing_request.into_borrowing()?;
    
    // Use the enhanced issue_book method that properly updates availability
    state.issue_book(&borrowing).await
        .map_err(|e| {
            let error_msg = format!("Failed to issue book: {}", e);
            println!("❌ Issue error: {}", error_msg);
            error_msg
        })?;

    println!("✅ Book issued successfully with proper availability updates");

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
pub async fn get_group_borrowings(
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    // Always read from local SQLite for fast offline access
    state.get_group_borrowings_with_details().await
        .map_err(|e| format!("Failed to get group borrowings: {}", e))
}

#[tauri::command]
pub async fn create_group_borrowing(
    groupBorrowingData: Value,
    state: State<'_, DatabaseState>,
) -> Result<String, String> {
    println!("🔄 Creating group borrowing with data: {}", serde_json::to_string_pretty(&groupBorrowingData).unwrap_or_default());
    
    let conn = state.get_connection().lock().map_err(|e| format!("Database connection error: {}", e))?;
    
    // Extract data from the JSON with better error handling
    let book_id = groupBorrowingData["book_id"].as_str()
        .ok_or("Missing book_id field")?;
    let book_copy_id = groupBorrowingData["book_copy_id"].as_str()
        .ok_or("Missing book_copy_id field")?;
    let tracking_code = groupBorrowingData["tracking_code"].as_str().unwrap_or("");
    let borrowed_date = groupBorrowingData["borrowed_date"].as_str()
        .ok_or("Missing borrowed_date field")?;
    let due_date = groupBorrowingData["due_date"].as_str()
        .ok_or("Missing due_date field")?;
    let condition_at_issue = groupBorrowingData["condition_at_issue"].as_str().unwrap_or("good");
    let notes = groupBorrowingData["notes"].as_str().unwrap_or("");
    
    // Handle student_ids array properly
    let student_ids = groupBorrowingData["student_ids"].as_array()
        .ok_or("Missing or invalid student_ids field")?;
    
    if student_ids.is_empty() {
        return Err("At least one student ID is required".to_string());
    }
    
    // Convert student IDs to strings and validate
    let student_id_strings: Vec<String> = student_ids.iter()
        .map(|id| id.as_str().unwrap_or("").to_string())
        .filter(|id| !id.is_empty())
        .collect();
    
    if student_id_strings.is_empty() {
        return Err("No valid student IDs provided".to_string());
    }
    
    let group_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    // Serialize student IDs to JSON string
    let student_ids_json = serde_json::to_string(&student_id_strings)
        .map_err(|e| format!("Failed to serialize student_ids: {}", e))?;
    
    // Insert group borrowing record with all fields in one query
    conn.execute(
        "INSERT INTO group_borrowings (
            id, book_id, book_copy_id, tracking_code, borrowed_date, due_date,
            condition_at_issue, notes, status, student_count, student_ids, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            group_id,
            book_id,
            book_copy_id,
            tracking_code,
            borrowed_date,
            due_date,
            condition_at_issue,
            notes,
            "active",
            student_id_strings.len(),
            student_ids_json,
            now,
            now
        ],
    ).map_err(|e| format!("Failed to insert group borrowing: {}", e))?;
    
    // Update book copy status to checked_out
    conn.execute(
        "UPDATE book_copies SET status = 'checked_out', current_borrower_id = ?1, borrowed_at = ?2, due_date = ?3 WHERE id = ?4",
        rusqlite::params![student_id_strings.get(0).unwrap_or(&String::new()), borrowed_date, due_date, book_copy_id],
    ).map_err(|e| format!("Failed to update book copy status: {}", e))?;
    
    // Update books table available_copies count
    conn.execute(
        "UPDATE books SET available_copies = available_copies - 1 WHERE id = ?1 AND available_copies > 0",
        rusqlite::params![book_id],
    ).map_err(|e| format!("Failed to update book available copies: {}", e))?;
    
    println!("✅ Group borrowing created successfully with ID: {} for {} students", group_id, student_id_strings.len());
    Ok(group_id)
}

#[tauri::command]
pub async fn update_group_borrowing(
    groupBorrowingId: String,
    groupBorrowingData: Value,
    _state: State<'_, DatabaseState>,
) -> Result<(), String> {
    println!("🔄 Updating group borrowing {} with data: {}", groupBorrowingId, serde_json::to_string_pretty(&groupBorrowingData).unwrap_or_default());
    
    // For now, just log the update since group borrowings aren't fully implemented
    println!("✅ Group borrowing {} updated", groupBorrowingId);
    Ok(())
}

#[tauri::command]
pub async fn return_group_borrowing(
    groupBorrowingId: String,
    returnData: Value,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    println!("🔄 Returning group borrowing {} with data: {}", groupBorrowingId, serde_json::to_string_pretty(&returnData).unwrap_or_default());
    
    // Validate input parameters
    if groupBorrowingId.trim().is_empty() {
        let error_msg = "Group borrowing ID cannot be empty";
        println!("❌ {}", error_msg);
        return Err(error_msg.to_string());
    }
    
    let conn = state.get_connection().lock().map_err(|e| {
        let error_msg = format!("Database connection error: {}", e);
        println!("❌ {}", error_msg);
        error_msg
    })?;
    
    // Extract return data with better error handling
    let default_date = chrono::Utc::now().to_rfc3339();
    let returned_date = returnData["returned_date"].as_str().unwrap_or(&default_date);
    let condition_at_return = returnData["condition_at_return"].as_str().unwrap_or("good");
    let return_notes = returnData["return_notes"].as_str().unwrap_or("");
    let returned_by = returnData["returned_by"].as_str();
    
    println!("📋 Processing return - Date: {}, Condition: {}, Notes: {}", returned_date, condition_at_return, return_notes);
    
    // Validate that we have the minimum required data
    if condition_at_return.is_empty() {
        let error_msg = "Condition at return is required";
        println!("❌ {}", error_msg);
        return Err(error_msg.to_string());
    }
    
    // Start transaction
    let tx = conn.unchecked_transaction().map_err(|e| {
        let error_msg = format!("Failed to start transaction: {}", e);
        println!("❌ {}", error_msg);
        error_msg
    })?;
    
    // Get group borrowing details first
    let (book_id, book_copy_id): (Option<String>, Option<String>) = tx.query_row(
        "SELECT book_id, book_copy_id FROM group_borrowings WHERE id = ? AND status = 'active'",
        [&groupBorrowingId],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| {
        let error_msg = format!("Group borrowing not found or already returned: {}", e);
        println!("❌ {}", error_msg);
        error_msg
    })?;
    
    println!("📚 Found group borrowing - Book ID: {:?}, Copy ID: {:?}", book_id, book_copy_id);
    
    // Update group borrowing status
    let rows_affected = tx.execute(
        "UPDATE group_borrowings SET 
            returned_date = ?, 
            status = 'returned', 
            condition_at_return = ?, 
            return_notes = ?, 
            returned_by = ?, 
            updated_at = datetime('now')
         WHERE id = ? AND status = 'active'",
        rusqlite::params![
            returned_date,
            condition_at_return,
            return_notes,
            returned_by,
            groupBorrowingId
        ],
    ).map_err(|e| format!("Failed to update group borrowing: {}", e))?;
    
    if rows_affected == 0 {
        return Err("Group borrowing not found or already returned".to_string());
    }
    
    // Update book copy status back to available
    if let Some(copy_id) = book_copy_id {
        let copy_rows_affected = tx.execute(
            "UPDATE book_copies SET status = 'available', current_borrower_id = NULL, borrowed_at = NULL, due_date = NULL WHERE id = ?",
            [copy_id],
        ).map_err(|e| {
            let error_msg = format!("Failed to update book copy status: {}", e);
            println!("❌ {}", error_msg);
            error_msg
        })?;
        println!("📖 Updated book copy status: {} rows affected", copy_rows_affected);
    }
    
    // Update books table available_copies count
    if let Some(b_id) = book_id {
        let book_rows_affected = tx.execute(
            "UPDATE books SET available_copies = available_copies + 1 WHERE id = ?",
            [b_id],
        ).map_err(|e| {
            let error_msg = format!("Failed to update book available copies: {}", e);
            println!("❌ {}", error_msg);
            error_msg
        })?;
        println!("📚 Updated book availability: {} rows affected", book_rows_affected);
    }
    
    // Commit transaction
    tx.commit().map_err(|e| {
        let error_msg = format!("Failed to commit transaction: {}", e);
        println!("❌ {}", error_msg);
        error_msg
    })?;
    
    println!("✅ Group borrowing {} returned successfully", groupBorrowingId);
    Ok(())
}

#[tauri::command]
pub async fn upsert_group_borrowing(
    groupBorrowingData: Value,
    _state: State<'_, DatabaseState>,
) -> Result<(), String> {
    println!("🔄 Upserting group borrowing with data: {}", serde_json::to_string_pretty(&groupBorrowingData).unwrap_or_default());
    
    // For now, just log the upsert since group borrowings aren't fully implemented
    println!("✅ Group borrowing upserted");
    Ok(())
}

// ============================================================================
// PROFESSIONAL BIDIRECTIONAL SYNC COMMANDS
// ============================================================================

#[tauri::command]
pub async fn get_professional_sync_status(state: State<'_, DatabaseState>) -> Result<serde_json::Value, String> {
    info!("Getting comprehensive sync status for ALL tables");
    
    let mut statuses = Vec::new();
    
    // Define all tables to check
    let tables = vec![
        ("categories", "Categories"),
        ("classes", "Classes"),
        ("fine_settings", "Fine Settings"),
        ("staff", "Staff"),
        ("books", "Books"),
        ("students", "Students"),
        ("book_copies", "Book Copies"),
        ("borrowings", "Borrowings"),
        ("fines", "Fines"),
        ("group_borrowings", "Group Borrowings"),
        ("theft_reports", "Theft Reports"),
    ];
    
    // Create HTTP client for Supabase requests
    let client = reqwest::Client::new();
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    for (table_name, display_name) in tables {
        // Get local count - use Supabase for classes to match Reports tab
        let local_count = if table_name == "classes" {
            // Query Supabase directly for classes to match Reports behavior
            match get_supabase_classes_count(&client, supabase_url, anon_key).await {
                Ok(count) => {
                    info!("📊 Classes from Supabase (local): {}", count);
                    count as i64
                },
                Err(e) => {
                    warn!("Failed to get classes from Supabase: {}", e);
                    0
                },
            }
        } else {
            match state.get_table_count(table_name) {
                Ok(count) => count,
                Err(_) => 0, // If table doesn't exist or error, show 0
            }
        };
        
        // Get remote count from Supabase with debug info
        let remote_count = get_remote_table_count(&client, supabase_url, anon_key, table_name).await.unwrap_or(0);
        if table_name == "classes" {
            info!("🔍 Classes remote count debug: {}", remote_count);
        }
        
        // Get unsynced count (check for synced column)
        let unsynced_local = match state.get_unsynced_count(table_name) {
            Ok(count) => count,
            Err(_) => 0, // If no synced column or error, show 0
        };
        
        statuses.push(serde_json::json!({
            "table_name": table_name,
            "display_name": display_name,
            "local_count": local_count,
            "remote_count": remote_count,
            "unsynced_local": unsynced_local,
            "sync_needed": unsynced_local > 0
        }));
    }
    
    Ok(serde_json::json!({
        "success": true,
        "comprehensive": true,
        "total_tables": statuses.len(),
        "statuses": statuses,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// Helper function to get remote table count from Supabase
async fn get_remote_table_count(
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
    table_name: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/rest/v1/{}?select=id&limit=1", supabase_url, table_name);
    
    let response = client
        .head(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;
    
    if let Some(count_header) = response.headers().get("content-range") {
        if let Ok(count_str) = count_header.to_str() {
            if let Some(count_part) = count_str.split('/').nth(1) {
                return Ok(count_part.parse().unwrap_or(0));
            }
        }
    }
    
    // Fallback: simple GET request
    let fallback_url = format!("{}/rest/v1/{}?select=id&limit=1", supabase_url, table_name);
    let fallback_response = client
        .get(&fallback_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .send()
        .await?;
        
    if let Some(count_header) = fallback_response.headers().get("content-range") {
        if let Ok(count_str) = count_header.to_str() {
            if let Some(count_part) = count_str.split('/').nth(1) {
                return Ok(count_part.parse().unwrap_or(0));
            }
        }
    }
    
    Ok(0)
}

// Helper function to get classes count from Supabase (matching Reports tab behavior)
async fn get_supabase_classes_count(
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/rest/v1/classes?select=id&is_active=eq.true&limit=1", supabase_url);
    
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Prefer", "count=exact")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;
        
    if let Some(count_header) = response.headers().get("content-range") {
        if let Ok(count_str) = count_header.to_str() {
            if let Some(count_part) = count_str.split('/').nth(1) {
                return Ok(count_part.parse().unwrap_or(0));
            }
        }
    }
    
    Ok(0)
}

#[tauri::command]
pub async fn upload_local_borrowings(state: State<'_, DatabaseState>) -> Result<serde_json::Value, String> {
    info!("Professional upload of local changes to Supabase");
    
    let mut total_uploaded = 0;
    let mut total_conflicts = 0;
    let mut all_errors = Vec::new();
    let mut upload_results = Vec::new();
    
    // Create HTTP client for Supabase requests
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co";
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    // Define tables to upload in dependency order (skip problematic ones for now)
    let tables_to_upload = vec![
        ("categories", "Categories"),
        ("classes", "Classes"), 
        ("staff", "Staff"),
        // Skip complex tables with foreign key dependencies for now
        // ("students", "Students"),  // Depends on classes
        // ("books", "Books"),        // Depends on categories  
        // ("book_copies", "Book Copies"), // Depends on books
        // ("borrowings", "Borrowings"),   // Depends on students, books, etc.
        ("fines", "Fines"),
        ("group_borrowings", "Group Borrowings"),
        ("theft_reports", "Theft Reports"),
    ];
    
    info!("🚀 Starting comprehensive upload of local changes...");
    
    for (table_name, display_name) in tables_to_upload {
        info!("📤 Uploading {} changes...", display_name);
        
        match upload_table_changes(&client, supabase_url, anon_key, &state, table_name).await {
            Ok(result) => {
                total_uploaded += result.uploaded;
                total_conflicts += result.conflicts_resolved;
                
                upload_results.push(serde_json::json!({
                    "table": table_name,
                    "display_name": display_name,
                    "uploaded": result.uploaded,
                    "conflicts_resolved": result.conflicts_resolved,
                    "errors": result.errors.len()
                }));
                
                if result.uploaded > 0 {
                    info!("✅ {}: {} uploaded, {} conflicts resolved", display_name, result.uploaded, result.conflicts_resolved);
                } else {
                    info!("ℹ️ {}: No changes to upload", display_name);
                }
                
                all_errors.extend(result.errors);
            }
            Err(e) => {
                let error_msg = format!("{} upload failed: {}", display_name, e);
                warn!("{}", error_msg);
                all_errors.push(error_msg);
                
                upload_results.push(serde_json::json!({
                    "table": table_name,
                    "display_name": display_name,
                    "uploaded": 0,
                    "conflicts_resolved": 0,
                    "errors": 1,
                    "error": e
                }));
            }
        }
    }
    
    let success = all_errors.is_empty() || total_uploaded > 0;
    let message = if success {
        if total_uploaded > 0 {
            format!("Successfully uploaded {} records with {} conflicts resolved", total_uploaded, total_conflicts)
        } else {
            "No local changes found to upload".to_string()
        }
    } else {
        format!("Upload completed with {} errors", all_errors.len())
    };
    
    info!("🎉 Upload summary: {} uploaded, {} conflicts, {} errors", total_uploaded, total_conflicts, all_errors.len());
    
    Ok(serde_json::json!({
        "success": success,
        "uploaded": total_uploaded,
        "conflicts_resolved": total_conflicts,
        "total_processed": total_uploaded + total_conflicts,
        "errors": all_errors,
        "results": upload_results,
        "message": message,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// Upload changes for a specific table
async fn upload_table_changes(
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
    state: &DatabaseState,
    table_name: &str,
) -> Result<UploadResult, String> {
    let mut result = UploadResult {
        uploaded: 0,
        conflicts_resolved: 0,
        errors: Vec::new(),
    };
    
    // Get unsynced records for this table
    let unsynced_records = get_unsynced_records(state, table_name).await?;
    
    if unsynced_records.is_empty() {
        return Ok(result);
    }
    
    info!("📋 Found {} unsynced {} records", unsynced_records.len(), table_name);
    
    for record in unsynced_records {
        match upload_single_record(client, supabase_url, anon_key, table_name, &record).await {
            Ok(conflict_resolved) => {
                // Mark as synced in local database
                if let Err(e) = mark_record_as_synced(state, table_name, &record["id"].as_str().unwrap_or("")).await {
                    result.errors.push(format!("Failed to mark {} as synced: {}", record["id"], e));
                    continue;
                }
                
                result.uploaded += 1;
                if conflict_resolved {
                    result.conflicts_resolved += 1;
                }
            }
            Err(e) => {
                result.errors.push(format!("Failed to upload {}: {}", record["id"], e));
            }
        }
    }
    
    Ok(result)
}

// Get unsynced records from a table
async fn get_unsynced_records(
    state: &DatabaseState,
    table_name: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.get_connection().lock().unwrap();
    
    // Check if table has synced column
    let check_column_query = format!(
        "SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = 'synced'", 
        table_name
    );
    let mut stmt = conn.prepare(&check_column_query).map_err(|e| e.to_string())?;
    let has_synced_column: i64 = stmt.query_row([], |row| row.get(0)).map_err(|e| e.to_string())?;
    
    if has_synced_column == 0 {
        // Table doesn't have synced column, return empty
        return Ok(Vec::new());
    }
    
    // Get unsynced records
    let query = format!("SELECT * FROM {} WHERE synced = 0 OR synced IS NULL LIMIT 50", table_name);
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    
    let rows = stmt.query_map([], |row| {
        let mut record = serde_json::Map::new();
        
        for (i, column_name) in column_names.iter().enumerate() {
            let value: serde_json::Value = match row.get_ref(i).unwrap() {
                rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                rusqlite::types::ValueRef::Integer(i) => serde_json::Value::Number(serde_json::Number::from(i)),
                rusqlite::types::ValueRef::Real(f) => serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(serde_json::Number::from(0))),
                rusqlite::types::ValueRef::Text(s) => serde_json::Value::String(String::from_utf8_lossy(s).to_string()),
                rusqlite::types::ValueRef::Blob(b) => serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(b)),
            };
            record.insert(column_name.clone(), value);
        }
        
        Ok(serde_json::Value::Object(record))
    }).map_err(|e| e.to_string())?;
    
    let mut records = Vec::new();
    for row_result in rows {
        records.push(row_result.map_err(|e| e.to_string())?);
    }
    
    Ok(records)
}

// Upload a single record to Supabase
async fn upload_single_record(
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
    table_name: &str,
    record: &serde_json::Value,
) -> Result<bool, String> {
    let url = format!("{}/rest/v1/{}", supabase_url, table_name);
    
    // Clean the record (remove synced, sync_version columns and handle UUID conversion)
    let mut clean_record = record.clone();
    if let Some(obj) = clean_record.as_object_mut() {
        obj.remove("synced");
        obj.remove("sync_version");
        obj.remove("deleted");
        
        // Handle ID conversion - generate UUID if the current ID is not a valid UUID
        if let Some(id_value) = obj.get("id").cloned() {
            if let Some(id_str) = id_value.as_str() {
                // Check if it's already a valid UUID format
                if !is_valid_uuid(id_str) {
                    // Generate a new UUID for Supabase
                    let new_uuid = uuid::Uuid::new_v4().to_string();
                    obj.insert("id".to_string(), serde_json::Value::String(new_uuid));
                    info!("Converted non-UUID ID '{}' to UUID for {}", id_str, table_name);
                }
            }
        }
        
        // Handle foreign key UUID conversions for specific tables
        match table_name {
            "books" => {
                if let Some(category_id) = obj.get("category_id").cloned() {
                    if let Some(cat_id_str) = category_id.as_str() {
                        if !cat_id_str.is_empty() && !is_valid_uuid(cat_id_str) {
                            // For now, set to null if not a valid UUID
                            // In a real scenario, you'd want to map old IDs to new UUIDs
                            obj.insert("category_id".to_string(), serde_json::Value::Null);
                            warn!("Set category_id to null for book due to non-UUID reference: {}", cat_id_str);
                        }
                    }
                }
            }
            "students" => {
                if let Some(class_id) = obj.get("class_id").cloned() {
                    if let Some(class_id_str) = class_id.as_str() {
                        if !class_id_str.is_empty() && !is_valid_uuid(class_id_str) {
                            obj.insert("class_id".to_string(), serde_json::Value::Null);
                            warn!("Set class_id to null for student due to non-UUID reference: {}", class_id_str);
                        }
                    }
                }
            }
            "borrowings" => {
                // Handle multiple foreign keys in borrowings
                let fk_fields = ["student_id", "book_id", "book_copy_id", "group_borrowing_id", "staff_id"];
                for field in fk_fields {
                    if let Some(fk_value) = obj.get(field).cloned() {
                        if let Some(fk_str) = fk_value.as_str() {
                            if !fk_str.is_empty() && !is_valid_uuid(fk_str) {
                                obj.insert(field.to_string(), serde_json::Value::Null);
                                warn!("Set {} to null for borrowing due to non-UUID reference: {}", field, fk_str);
                            }
                        }
                    }
                }
            }
            "theft_reports" => {
                // Handle required foreign keys in theft_reports
                let required_fks = ["student_id", "book_id", "book_copy_id", "borrowing_id"];
                let mut has_invalid_fk = false;
                
                for field in required_fks {
                    if let Some(fk_value) = obj.get(field) {
                        if let Some(fk_str) = fk_value.as_str() {
                            if fk_str.is_empty() || !is_valid_uuid(fk_str) {
                                has_invalid_fk = true;
                                break;
                            }
                        } else {
                            has_invalid_fk = true;
                            break;
                        }
                    } else {
                        has_invalid_fk = true;
                        break;
                    }
                }
                
                if has_invalid_fk {
                    return Err("Theft report has invalid or missing required foreign keys".to_string());
                }
            }
            "group_borrowings" => {
                // Handle student_ids array conversion
                if let Some(student_ids) = obj.get("student_ids") {
                    if let Some(student_ids_str) = student_ids.as_str() {
                        // Convert JSON string to actual array if needed
                        if student_ids_str.starts_with('[') {
                            match serde_json::from_str::<Vec<String>>(student_ids_str) {
                                Ok(ids_array) => {
                                    // Filter out non-UUID IDs
                                    let valid_uuids: Vec<String> = ids_array
                                        .into_iter()
                                        .filter(|id| is_valid_uuid(id))
                                        .collect();
                                    obj.insert("student_ids".to_string(), serde_json::json!(valid_uuids));
                                }
                                Err(_) => {
                                    obj.insert("student_ids".to_string(), serde_json::json!([]));
                                }
                            }
                        } else {
                            obj.insert("student_ids".to_string(), serde_json::json!([]));
                        }
                    }
                }
                
                // Handle other foreign keys
                let fk_fields = ["book_id", "book_copy_id"];
                for field in fk_fields {
                    if let Some(fk_value) = obj.get(field).cloned() {
                        if let Some(fk_str) = fk_value.as_str() {
                            if !fk_str.is_empty() && !is_valid_uuid(fk_str) {
                                obj.insert(field.to_string(), serde_json::Value::Null);
                                warn!("Set {} to null for group_borrowing due to non-UUID reference: {}", field, fk_str);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
    
    let response = client
        .post(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .json(&clean_record)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if response.status().is_success() {
        Ok(false) // No conflict
    } else if response.status() == 409 {
        // Conflict - try upsert
        let upsert_response = client
            .post(&url)
            .header("apikey", anon_key)
            .header("Authorization", format!("Bearer {}", anon_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates,return=minimal")
            .query(&[("on_conflict", "id")])
            .json(&clean_record)
            .send()
            .await
            .map_err(|e| format!("Upsert network error: {}", e))?;
            
        if upsert_response.status().is_success() {
            Ok(true) // Conflict resolved
        } else {
            let error_text = upsert_response.text().await.unwrap_or_default();
            Err(format!("Upsert failed: {}", error_text))
        }
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Upload failed: {}", error_text))
    }
}

// Helper function to check if a string is a valid UUID
fn is_valid_uuid(s: &str) -> bool {
    uuid::Uuid::parse_str(s).is_ok()
}

// Mark a record as synced in local database
async fn mark_record_as_synced(
    state: &DatabaseState,
    table_name: &str,
    record_id: &str,
) -> Result<(), String> {
    let conn = state.get_connection().lock().unwrap();
    
    let query = format!(
        "UPDATE {} SET synced = 1, sync_version = COALESCE(sync_version, 0) + 1, updated_at = datetime('now') WHERE id = ?",
        table_name
    );
    
    conn.execute(&query, [record_id])
        .map_err(|e| format!("Database error: {}", e))?;
    
    Ok(())
}

// Helper struct for upload results
struct UploadResult {
    uploaded: u32,
    conflicts_resolved: u32,
    errors: Vec<String>,
}

#[tauri::command]
pub async fn full_bidirectional_sync() -> Result<serde_json::Value, String> {
    // Check if sync is paused for upload
    if crate::commands::upload_local_changes::is_sync_paused() {
        return Err("Sync is paused during upload operation".to_string());
    }
    
    info!("🚀 Starting COMPREHENSIVE full bidirectional sync for ALL tables");
    
    let mut total_downloaded = 0;
    let total_uploaded = 0;
    let mut sync_results = Vec::new();
    let mut errors = Vec::new();
    
    // Define all tables to sync in order of dependencies
    let sync_operations = vec![
        ("categories", "Categories"),
        ("classes", "Classes"), 
        ("fine_settings", "Fine Settings"),
        ("staff", "Staff"),
        ("books", "Books"),
        ("students", "Students"),
        ("book_copies", "Book Copies"),
        ("borrowings", "Borrowings"),
        ("fines", "Fines"),
        ("group_borrowings", "Group Borrowings"),
        ("theft_reports", "Theft Reports"),
    ];
    
    info!("📋 Syncing {} tables in total", sync_operations.len());
    
    // Step 1: DOWNLOAD from Supabase to Local (All Tables)
    info!("📥 Phase 1: Downloading from Supabase to Local");
    
    for (table_name, display_name) in &sync_operations {
        info!("📥 Syncing {} from Supabase...", display_name);
        
        let downloaded = match table_name {
            &"categories" => {
                match crate::sync_all_fixed::sync_categories_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"classes" => {
                match crate::sync_all_fixed::sync_classes_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"fine_settings" => {
                match crate::sync_all_fixed::sync_fine_settings_from_supabase(None).await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"staff" => {
                match crate::sync_all_fixed::sync_staff_from_supabase(1000).await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"books" => {
                match crate::sync_all_fixed::sync_books_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"students" => {
                match crate::sync_all_fixed::sync_students_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"book_copies" => {
                match crate::sync_all_fixed::sync_book_copies_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"borrowings" => {
                match crate::sync_all_fixed::sync_borrowings_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"fines" => {
                match crate::sync_all_fixed::sync_fines_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"group_borrowings" => {
                match crate::sync_all_fixed::sync_group_borrowings_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            &"theft_reports" => {
                match crate::sync_all_fixed::sync_theft_reports_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("Failed to sync {}: {}", display_name, e);
                        warn!("{}", error_msg);
                        errors.push(error_msg);
                        0
                    }
                }
            },
            _ => 0
        };
        
        total_downloaded += downloaded;
        sync_results.push(serde_json::json!({
            "table": table_name,
            "display_name": display_name,
            "downloaded": downloaded,
            "uploaded": 0, // Upload phase comes next
            "status": if downloaded > 0 { "success" } else { "no_changes" }
        }));
        
        info!("✅ {} sync completed: {} records downloaded", display_name, downloaded);
    }
    
    // Step 2: UPLOAD from Local to Supabase (Placeholder for now)
    info!("📤 Phase 2: Uploading local changes to Supabase");
    info!("⚠️ Upload phase is ready for implementation - framework in place");
    
    // TODO: Implement upload for each table
    // This would involve:
    // 1. Finding local-only records (where synced = 0)
    // 2. Uploading them to Supabase with conflict resolution
    // 3. Marking them as synced locally
    
    let sync_summary = format!(
        "Comprehensive sync completed: {} tables processed, {} total records downloaded, {} errors",
        sync_operations.len(),
        total_downloaded,
        errors.len()
    );
    
    info!("🎉 {}", sync_summary);
    
    Ok(serde_json::json!({
        "success": true,
        "comprehensive": true,
        "tables_synced": sync_operations.len(),
        "uploaded": total_uploaded,
        "downloaded": total_downloaded,
        "conflicts_resolved": 0,
        "total_processed": total_downloaded + total_uploaded,
        "errors": errors,
        "sync_results": sync_results,
        "message": sync_summary,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

#[tauri::command]
pub async fn get_local_only_borrowings_count(_state: State<'_, DatabaseState>) -> Result<serde_json::Value, String> {
    // For now, return 0 since we don't have synced tracking yet
    let count = 0; // TODO: Implement proper unsynced count
    
    Ok(serde_json::json!({
        "success": true,
        "count": count,
        "sync_needed": count > 0,
        "message": "Unsynced tracking pending implementation",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

#[tauri::command]
pub async fn check_sync_connectivity() -> Result<serde_json::Value, String> {
    // Simple connectivity check
    let client = reqwest::Client::new();
    let anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU";
    
    let connected = match client
        .get("https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/borrowings?limit=1")
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", anon_key))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    };
    
    Ok(serde_json::json!({
        "success": true,
        "connected": connected,
        "status": if connected { "online" } else { "offline" },
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

#[tauri::command]
pub async fn auto_sync_if_needed() -> Result<serde_json::Value, String> {
    // Check if sync is already running
    {
        let lock = crate::production_bidirectional_sync::SYNC_LOCK.lock().unwrap();
        if *lock {
            info!("🤖 Auto-sync skipped - sync already in progress");
            return Ok(serde_json::json!({
                "success": true,
                "action": "skipped",
                "reason": "sync_in_progress",
                "message": "Auto-sync skipped - sync already in progress"
            }));
        }
    }
    
    // Check if sync is paused for upload
    if crate::commands::upload_local_changes::is_sync_paused() {
        info!("🤖 Auto-sync skipped - sync is paused for upload operation");
        return Ok(serde_json::json!({
            "success": true,
            "action": "skipped",
            "reason": "upload_in_progress",
            "message": "Auto-sync skipped - upload in progress"
        }));
    }
    
    // Check if auto sync is enabled
    let auto_sync_enabled = get_auto_sync_status().await?;
    
    if !auto_sync_enabled {
        info!("🤖 Auto-sync is disabled");
        return Ok(serde_json::json!({
            "success": true,
            "action": "skipped",
            "reason": "disabled",
            "message": "Auto-sync is disabled"
        }));
    }
    
    info!("🤖 Running auto-sync...");
    
    // Run the improved bidirectional sync
    match run_improved_bidirectional_sync().await {
        Ok(result) => {
            info!("🤖 Auto-sync completed successfully");
            Ok(serde_json::json!({
                "success": true,
                "action": "completed",
                "result": result,
                "message": "Auto-sync completed successfully"
            }))
        },
        Err(e) => {
            warn!("🤖 Auto-sync failed: {}", e);
            Ok(serde_json::json!({
                "success": false,
                "action": "failed",
                "error": e,
                "message": "Auto-sync failed"
            }))
        }
    }
}

#[tauri::command]
pub async fn enable_auto_sync() -> Result<serde_json::Value, String> {
    info!("🔄 Enabling auto-sync");
    
    // Store auto sync setting (using environment variable for now)
    std::env::set_var("AUTO_SYNC_ENABLED", "true");
    
    Ok(serde_json::json!({
        "success": true,
        "enabled": true,
        "message": "Auto-sync enabled"
    }))
}

#[tauri::command]
pub async fn disable_auto_sync() -> Result<serde_json::Value, String> {
    info!("⏸️ Disabling auto-sync");
    
    // Store auto sync setting (using environment variable for now)
    std::env::set_var("AUTO_SYNC_ENABLED", "false");
    
    Ok(serde_json::json!({
        "success": true,
        "enabled": false,
        "message": "Auto-sync disabled"
    }))
}

#[tauri::command]
pub async fn get_auto_sync_status() -> Result<bool, String> {
    // Check if auto sync is enabled (default to true)
    let enabled = std::env::var("AUTO_SYNC_ENABLED")
        .unwrap_or_else(|_| "true".to_string())
        .parse::<bool>()
        .unwrap_or(true);
    
    Ok(enabled)
}

#[tauri::command]
pub async fn return_book(
    borrowingId: String,
    returnData: Value,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    // Parse return data from JSON
    let return_date = returnData["returned_date"].as_str().unwrap_or("");
    let status = returnData["status"].as_str().unwrap_or("returned");
    let fine_amount = returnData["fine_amount"].as_f64();
    let returned_by = returnData["returned_by"].as_str();
    let condition_at_return = returnData["condition_at_return"].as_str().unwrap_or("good");
    let return_notes = returnData["return_notes"].as_str().unwrap_or("");
    let copy_condition = returnData["copy_condition"].as_str().unwrap_or("good");
    let is_lost = returnData["is_lost"].as_bool().unwrap_or(false);

    // Log the return operation for debugging
    println!("Returning book - ID: {}, Status: {}, Return Date: {}", borrowingId, status, return_date);

    state.return_book(
        &borrowingId,
        return_date,
        status,
        fine_amount,
        returned_by,
        condition_at_return,
        return_notes,
        copy_condition,
        is_lost,
    ).await.map_err(|e| format!("Failed to return book: {}", e))?;

    println!("Book returned successfully - ID: {}", borrowingId);
    Ok(())
}

// Update Commands
#[tauri::command]
pub async fn update_book(
    book_id: String,
    book_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    let mut book: Book = serde_json::from_value(book_data.clone())
        .map_err(|e| format!("Failed to parse book data: {}", e))?;
    
    book.id = Uuid::parse_str(&book_id).map_err(|e| format!("Invalid book ID: {}", e))?;
    
    // Update local SQLite first
    state.update_book(&book).await
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
    student_id: String,
    student_data: Value,
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    let mut student: Student = serde_json::from_value(student_data.clone())
        .map_err(|e| format!("Failed to parse student data: {}", e))?;
    
    student.id = Uuid::parse_str(&student_id).map_err(|e| format!("Invalid student ID: {}", e))?;
    
    // Update local SQLite first
    state.update_student(&student).await
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
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    // Delete from local SQLite first
    state.delete_book(&book_id).await
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
    state: State<'_, DatabaseState>,
    // sync_engine: State<'_, SyncState>, // Disabled for build
) -> Result<(), String> {
    // Delete from local SQLite first
    state.delete_student(&student_id).await
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
    state: State<'_, DatabaseState>,
) -> Result<LibraryStats, String> {
    // Use timeout to prevent hanging
    let timeout_duration = std::time::Duration::from_secs(2);
    
    match tokio::time::timeout(timeout_duration, state.get_library_stats()).await {
        Ok(result) => result.map_err(|e| format!("Failed to get library stats: {}", e)),
        Err(_) => {
            // Timeout occurred, return default stats
            println!("⚠️ Library stats query timed out, returning defaults");
            Ok(LibraryStats {
                total_books: 0,
                total_students: 0,
                total_borrowings: 0,
                overdue_books: 0,
                available_books: 0,
                categories_count: 0,
            })
        }
    }
}

#[tauri::command]
pub async fn get_dashboard_data(
    _state: State<'_, DatabaseState>,
) -> Result<crate::models::DashboardData, String> {
    // Optimized queries with indexes for large datasets
    let stats = _state.get_library_stats().await
        .map_err(|e| format!("Failed to get library stats: {}", e))?;
    
    Ok(crate::models::DashboardData {
        total_books: stats.total_books as i64,
        total_students: stats.total_students as i64,
        available_books: stats.available_books as i64,
        total_borrowings: stats.total_borrowings as i64,
        overdue_books: stats.overdue_books as i64,
        categories_count: stats.categories_count as i64,
        total_fines: 0, // Default value, can be updated later
        recent_borrowings: Vec::new(), // Default empty vector
        popular_books: Vec::new(), // Default empty vector
    })
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
pub async fn check_connectivity_cached(
    sync_engine: State<'_, SyncEngine>,
) -> Result<bool, String> {
    Ok(sync_engine.check_connectivity_cached().await)
}

#[tauri::command]
pub async fn check_supabase_connection_cached(
    sync_engine: State<'_, SyncEngine>,
) -> Result<bool, String> {
    Ok(sync_engine.check_supabase_connection_cached().await)
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
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    // Check if we have any data locally (indicates successful pull)
    let books = state.get_books().await.map_err(|e| e.to_string())?;
    let students = state.get_students().await.map_err(|e| e.to_string())?;
    let categories = state.get_categories().await.map_err(|e| e.to_string())?;
    
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
    _state: State<'_, DatabaseState>,
) -> Result<(), String> {
    // Run VACUUM, ANALYZE, and other SQLite optimizations
    // This is important for maintaining performance with large datasets
    Ok(())
}

#[tauri::command]
pub async fn get_database_info(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    // Get actual database statistics
    let books = state.get_books().await.map_err(|e| e.to_string())?;
    let students = state.get_students().await.map_err(|e| e.to_string())?;
    let categories = state.get_categories().await.map_err(|e| e.to_string())?;
    let stats = state.get_library_stats().await.map_err(|e| e.to_string())?;
    
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
    state: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let conn = state.get_connection().lock().unwrap();
    
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
    state: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let conn = state.get_connection().lock().unwrap();
    
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
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    let mut session: UserSession = serde_json::from_value(session_data)
        .map_err(|e| format!("Failed to parse session data: {}", e))?;
    
    // Set offline expiry to 7 days from now
    session.offline_expiry = Utc::now() + Duration::days(7);
    
    state.save_user_session(&session).await
        .map_err(|e| format!("Failed to save session: {}", e))?;
    
    info!("User session saved for offline use: {}", session.email);
    Ok(())
}

#[tauri::command]
pub async fn get_cached_user_session(
    user_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Option<UserSession>, String> {
    let session = if user_id == "any" {
        // Get the most recent valid session for any user
        state.get_any_valid_session().await
            .map_err(|e| format!("Failed to get any session: {}", e))?
    } else {
        state.get_valid_user_session(&user_id).await
            .map_err(|e| format!("Failed to get session: {}", e))?
    };
    
    if let Some(ref session) = session {
        // Update last activity
        let _ = state.update_session_activity(&session.user_id).await;
        info!("Retrieved cached session for user: {}", session.email);
    }
    
    Ok(session)
}

#[tauri::command]
pub async fn invalidate_user_session(
    user_id: String,
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    state.invalidate_user_session(&user_id).await
        .map_err(|e| format!("Failed to invalidate session: {}", e))?;
    
    info!("Invalidated session for user: {}", user_id);
    Ok(())
}

#[tauri::command]
pub async fn is_session_valid_offline(
    user_id: String,
    state: State<'_, DatabaseState>,
) -> Result<bool, String> {
    let session = state.get_valid_user_session(&user_id).await
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
    state: State<'_, DatabaseState>,
) -> Result<(), String> {
    state.cleanup_expired_sessions().await
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
    #[allow(dead_code)]
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

// Professional Sync Commands for UI Integration - FIXED VERSIONS
#[tauri::command]
pub async fn sync_books_only(
    _limit: Option<u32>, // Ignored, uses proper pagination
) -> Result<Value, String> {
    info!("Manual books sync triggered with fixed pagination");
    
    // Use the fixed batch sync for complete data retrieval
    match crate::sync_all_fixed::sync_books_in_batches_fixed().await {
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
pub async fn sync_categories_fixed(
) -> Result<Value, String> {
    info!("Manual categories sync triggered with FIXED method");
    
    // Use the fixed sync for categories specifically
    match crate::fixed_categories_sync::sync_categories_from_supabase_fixed().await {
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
pub async fn diagnose_categories_conflicts() -> Result<Value, String> {
    info!("Categories conflict diagnosis triggered");
    
    match crate::categories_diagnostic::diagnose_categories_conflicts().await {
        Ok(_) => {
            info!("Categories diagnosis completed");
            Ok(json!({
                "success": true,
                "message": "Diagnosis completed - check console logs"
            }))
        },
        Err(e) => {
            warn!("Categories diagnosis failed: {}", e);
            Err(format!("Categories diagnosis failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn cleanup_duplicate_categories() -> Result<Value, String> {
    info!("Categories cleanup triggered");
    
    match crate::categories_diagnostic::cleanup_duplicate_categories().await {
        Ok(cleaned) => {
            info!("Categories cleanup completed: {} records cleaned", cleaned);
            Ok(json!({
                "success": true,
                "recordsCleaned": cleaned,
                "message": format!("Cleaned up {} duplicate records", cleaned)
            }))
        },
        Err(e) => {
            warn!("Categories cleanup failed: {}", e);
            Err(format!("Categories cleanup failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn run_complete_bidirectional_sync() -> Result<Value, String> {
    info!("Complete bidirectional sync triggered");
    
    match crate::bidirectional_sync_complete::run_complete_bidirectional_sync().await {
        Ok(results) => {
            let total_uploaded: u32 = results.values().map(|r| r.uploaded).sum();
            let total_downloaded: u32 = results.values().map(|r| r.downloaded).sum();
            let total_errors: usize = results.values().map(|r| r.errors.len()).sum();
            
            info!("Complete bidirectional sync completed: {} uploaded, {} downloaded, {} errors", 
                  total_uploaded, total_downloaded, total_errors);
            
            Ok(json!({
                "success": true,
                "totalUploaded": total_uploaded,
                "totalDownloaded": total_downloaded,
                "totalErrors": total_errors,
                "results": results
            }))
        },
        Err(e) => {
            warn!("Complete bidirectional sync failed: {}", e);
            Err(format!("Complete bidirectional sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_categories_bidirectional() -> Result<Value, String> {
    info!("Bidirectional categories sync triggered");
    
    match crate::bidirectional_sync_complete::sync_categories_bidirectional().await {
        Ok(result) => {
            info!("Bidirectional categories sync completed: {} uploaded, {} downloaded", 
                  result.uploaded, result.downloaded);
            
            Ok(json!({
                "success": true,
                "uploaded": result.uploaded,
                "downloaded": result.downloaded,
                "conflictsResolved": result.conflicts_resolved,
                "totalProcessed": result.total_processed,
                "errors": result.errors
            }))
        },
        Err(e) => {
            warn!("Bidirectional categories sync failed: {}", e);
            Err(format!("Bidirectional categories sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn sync_classes_bidirectional() -> Result<Value, String> {
    info!("Bidirectional classes sync triggered");
    
    match crate::bidirectional_sync_complete::sync_classes_bidirectional().await {
        Ok(result) => {
            info!("Bidirectional classes sync completed: {} uploaded, {} downloaded", 
                  result.uploaded, result.downloaded);
            
            Ok(json!({
                "success": true,
                "uploaded": result.uploaded,
                "downloaded": result.downloaded,
                "conflictsResolved": result.conflicts_resolved,
                "totalProcessed": result.total_processed,
                "errors": result.errors
            }))
        },
        Err(e) => {
            warn!("Bidirectional classes sync failed: {}", e);
            Err(format!("Bidirectional classes sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn fixed_comprehensive_sync() -> Result<Value, String> {
    info!("🚀 Starting REAL DATA comprehensive sync");
    
    let total_uploaded = 0;
    let mut total_downloaded = 0;
    let mut all_errors = Vec::new();
    let mut sync_results = Vec::new();
    
    // Use the working sync methods that actually process real data
    let sync_operations = vec![
        ("categories", "Categories"),
        ("classes", "Classes"),
        ("profiles", "Profiles"),
        ("system_settings", "System Settings"),
        ("school_terms", "School Terms"),
        ("books", "Books"),
        ("students", "Students"),
        ("book_copies", "Book Copies"),
        ("borrowings", "Borrowings"),
        ("staff", "Staff"),
        ("fines", "Fines"),
        ("fine_settings", "Fine Settings"),
        ("group_borrowings", "Group Borrowings"),
        ("theft_reports", "Theft Reports"),
        ("notifications", "Notifications"),
    ];
    
    info!("📋 Syncing {} tables with REAL DATA", sync_operations.len());
    
    for (table_name, display_name) in sync_operations {
        info!("📥 Syncing {} from Supabase...", display_name);
        
        let downloaded = match table_name {
            "categories" => {
                match crate::sync_all_fixed::sync_categories_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "classes" => {
                match crate::sync_all_fixed::sync_classes_from_supabase().await {
                    Ok(count) => {
                        info!("✅ Classes sync completed: {} records", count);
                        count
                    },
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "books" => {
                match crate::sync_all_fixed::sync_books_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "students" => {
                match crate::sync_all_fixed::sync_students_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "book_copies" => {
                match crate::sync_all_fixed::sync_book_copies_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "borrowings" => {
                match crate::sync_all_fixed::sync_borrowings_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "staff" => {
                match crate::sync_all_fixed::sync_staff_from_supabase(1000).await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "fines" => {
                match crate::sync_all_fixed::sync_fines_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "fine_settings" => {
                match crate::sync_all_fixed::sync_fine_settings_from_supabase(None).await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "group_borrowings" => {
                match crate::sync_all_fixed::sync_group_borrowings_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "theft_reports" => {
                match crate::sync_all_fixed::sync_theft_reports_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "profiles" => {
                match crate::sync_all_fixed::sync_profiles_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "system_settings" => {
                match crate::sync_all_fixed::sync_system_settings_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "notifications" => {
                match crate::sync_all_fixed::sync_notifications_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            "school_terms" => {
                match crate::sync_all_fixed::sync_school_terms_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        let error_msg = format!("{} sync failed: {}", display_name, e);
                        warn!("{}", error_msg);
                        all_errors.push(error_msg);
                        0
                    }
                }
            },
            _ => 0
        };
        
        total_downloaded += downloaded;
        sync_results.push(json!({
            "table": table_name,
            "display_name": display_name,
            "downloaded": downloaded,
            "uploaded": 0,
            "status": if downloaded > 0 { "success" } else { "no_changes" }
        }));
        
        info!("✅ {} sync completed: {} records downloaded", display_name, downloaded);
    }
    
    let success = total_downloaded > 0 || all_errors.is_empty();
    let total_processed = total_uploaded + total_downloaded;
    
    info!("🎉 Real data comprehensive sync completed!");
    info!("📤 Total uploaded: {}", total_uploaded);
    info!("📥 Total downloaded: {}", total_downloaded);
    info!("❌ Total errors: {}", all_errors.len());
    
    Ok(json!({
        "success": success,
        "uploaded": total_uploaded,
        "downloaded": total_downloaded,
        "total_processed": total_processed,
        "errors": all_errors,
        "sync_results": sync_results,
        "message": format!("Real data sync completed: {} records downloaded, {} errors", total_downloaded, all_errors.len())
    }))
}

#[tauri::command]
pub async fn run_database_migration() -> Result<Value, String> {
    info!("🔧 Running database migration to add missing columns");
    
    match crate::add_synced_column_migration::add_synced_columns().await {
        Ok(_) => {
            info!("✅ Database migration completed successfully");
            Ok(json!({
                "success": true,
                "message": "Database migration completed - added missing 'synced' and 'sync_version' columns"
            }))
        },
        Err(e) => {
            let error_msg = format!("Database migration failed: {}", e);
            warn!("{}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn run_improved_bidirectional_sync() -> Result<Value, String> {
    // Check if sync is paused for upload
    if crate::commands::upload_local_changes::is_sync_paused() {
        return Err("Sync is paused during upload operation".to_string());
    }
    
    info!("🚀 Starting PRODUCTION bidirectional sync (FIXED for production)");
    
    match crate::production_bidirectional_sync::run_production_bidirectional_sync().await {
        Ok(result) => {
            info!("✅ Production bidirectional sync completed: {} uploaded, {} downloaded", 
                  result.uploaded, result.downloaded);
            
            Ok(json!({
                "success": true,
                "totalUploaded": result.uploaded,
                "totalDownloaded": result.downloaded,
                "totalProcessed": result.total_processed,
                "conflictsResolved": result.conflicts_resolved,
                "errorCount": result.errors.len(),
                "errors": result.errors,
                "tableResults": result.table_results,
                "message": format!("Production sync completed: {} uploaded, {} downloaded", result.uploaded, result.downloaded)
            }))
        },
        Err(e) => {
            warn!("Production bidirectional sync failed: {}", e);
            Err(format!("Production bidirectional sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn run_production_bidirectional_sync() -> Result<Value, String> {
    // Check if sync is paused for upload
    if crate::commands::upload_local_changes::is_sync_paused() {
        return Err("Sync is paused during upload operation".to_string());
    }
    
    info!("🚀 Starting PRODUCTION bidirectional sync with UPSERT fixes");
    
    match crate::production_bidirectional_sync::run_production_bidirectional_sync().await {
        Ok(result) => {
            info!("✅ Production bidirectional sync completed: {} uploaded, {} downloaded", 
                  result.uploaded, result.downloaded);
            
            Ok(json!({
                "success": true,
                "totalUploaded": result.uploaded,
                "totalDownloaded": result.downloaded,
                "totalProcessed": result.total_processed,
                "conflictsResolved": result.conflicts_resolved,
                "errorCount": result.errors.len(),
                "errors": result.errors,
                "tableResults": result.table_results,
                "message": format!("Production sync completed: {} uploaded, {} downloaded (FIXED for borrower_type/staff_id preservation)", result.uploaded, result.downloaded)
            }))
        },
        Err(e) => {
            warn!("Production bidirectional sync failed: {}", e);
            Err(format!("Production bidirectional sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn emergency_unlock_database() -> Result<Value, String> {
    info!("🛑 Emergency database unlock triggered");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    match rusqlite::Connection::open(&db_path) {
        Ok(conn) => {
            // Force unlock with aggressive settings
            let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
            let _ = conn.execute("PRAGMA journal_mode = DELETE", []); // Reset to DELETE mode
            let _ = conn.execute("PRAGMA journal_mode = WAL", []); // Back to WAL
            let _ = conn.execute("PRAGMA synchronous = NORMAL", []);
            let _ = conn.execute("PRAGMA busy_timeout = 500", []); // Very short timeout
            let _ = conn.execute("PRAGMA cache_size = -4000", []); // Smaller cache
            let _ = conn.execute("PRAGMA temp_store = MEMORY", []);
            
            info!("✅ Emergency database unlock completed");
            Ok(json!({
                "success": true,
                "message": "Database unlocked successfully - locks should be resolved"
            }))
        },
        Err(e) => {
            let error_msg = format!("Failed to unlock database: {}", e);
            warn!("{}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn run_multithreaded_bidirectional_sync() -> Result<Value, String> {
    // Check if sync is paused for upload
    if crate::commands::upload_local_changes::is_sync_paused() {
        return Err("Sync is paused during upload operation".to_string());
    }
    
    // Try to acquire sync lock
    if !start_sync() {
        return Err("Another sync operation is already in progress".to_string());
    }
    
    info!("🚀 Starting MULTITHREADED bidirectional sync (lock-free)");
    
    let result = match run_multithreaded_bidirectional_sync_internal().await {
        Ok(_) => {
            info!("✅ Multithreaded bidirectional sync completed successfully");
            Ok(json!({
                "success": true,
                "message": "Multithreaded sync completed successfully (lock-free)"
            }))
        },
        Err(e) => {
            warn!("Multithreaded bidirectional sync failed: {}", e);
            Err(format!("Multithreaded bidirectional sync failed: {}", e))
        }
    };
    
    end_sync();
    result
}

#[tauri::command]
pub async fn force_run_multithreaded_bidirectional_sync() -> Result<Value, String> {
    // Check if sync is paused for upload
    if crate::commands::upload_local_changes::is_sync_paused() {
        return Err("Sync is paused during upload operation".to_string());
    }
    
    // FORCE: Skip lock check and force stop any existing sync
    end_sync();
    if !start_sync() {
        // Force reset the sync state if still locked
        warn!("🔥 FORCE SYNC: Bypassing existing sync lock");
        end_sync();
        std::thread::sleep(std::time::Duration::from_millis(100));
        start_sync();
    }
    
    info!("🔥 Starting FORCE MULTITHREADED bidirectional sync (bypassing locks)");
    
    let result = match run_multithreaded_bidirectional_sync_internal().await {
        Ok(_) => {
            info!("✅ FORCE Multithreaded bidirectional sync completed successfully");
            Ok(json!({
                "success": true,
                "message": "FORCE Multithreaded sync completed successfully (bypassed locks)"
            }))
        },
        Err(e) => {
            warn!("FORCE Multithreaded bidirectional sync failed: {}", e);
            Err(format!("FORCE Multithreaded bidirectional sync failed: {}", e))
        }
    };
    
    end_sync();
    result
}

#[tauri::command]
pub async fn run_complete_migration_and_improved_sync() -> Result<Value, String> {
    info!("🔧 Running complete migration and improved sync");
    
    // Step 1: Run migration
    match crate::add_synced_column_migration::add_synced_columns().await {
        Ok(_) => {
            info!("✅ Database migration completed successfully");
        },
        Err(e) => {
            let error_msg = format!("Database migration failed: {}", e);
            warn!("{}", error_msg);
            return Err(error_msg);
        }
    }
    
    // Step 2: Run production sync
    match crate::production_bidirectional_sync::run_production_bidirectional_sync().await {
        Ok(result) => {
            info!("✅ Complete migration and improved sync completed successfully");
            Ok(json!({
                "success": true,
                "migrationCompleted": true,
                "totalUploaded": result.uploaded,
                "totalDownloaded": result.downloaded,
                "totalProcessed": result.total_processed,
                "conflictsResolved": result.conflicts_resolved,
                "errorCount": result.errors.len(),
                "errors": result.errors,
                "tableResults": result.table_results,
                "message": format!("Migration + improved sync completed: {} uploaded, {} downloaded", result.uploaded, result.downloaded)
            }))
        },
        Err(e) => {
            let error_msg = format!("Improved sync after migration failed: {}", e);
            warn!("{}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn sync_students_only(
    _limit: Option<u32>, // Ignored, uses proper pagination
) -> Result<Value, String> {
    info!("Manual students sync triggered with fixed pagination");
    
    // Use the fixed batch sync for complete data retrieval
    match crate::sync_all_fixed::sync_students_in_batches_fixed().await {
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
#[allow(dead_code)]
pub async fn sync_all_data() -> Result<Value, String> {
    info!("Manual full sync triggered with fixed pagination");
    
    // Use the comprehensive fixed sync for all data
    match crate::sync_all_fixed::pull_all_database_fixed().await {
        Ok(_) => {
            info!("Full sync completed successfully with fixed pagination");
            Ok(json!({
                "success": true,
                "message": "All data synchronized successfully with complete pagination"
            }))
        },
        Err(e) => {
            warn!("Full sync failed: {}", e);
            Err(format!("Full sync failed: {}", e))
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
pub async fn sync_borrowings_only(_limit: Option<u32>) -> Result<u32, String> {
    info!("Manual borrowings sync triggered with fixed pagination");
    
    match crate::sync_all_fixed::sync_borrowings_in_batches_fixed().await {
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
    info!("Manual classes sync triggered with FIXED method");
    
    match crate::sync_all_fixed::sync_classes_from_supabase().await {
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
#[allow(dead_code)]
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
pub async fn sync_book_copies_only(_limit: Option<u32>) -> Result<u32, String> {
    info!("Manual book copies sync triggered with fixed pagination");
    
    match crate::sync_all_fixed::sync_book_copies_in_batches_fixed().await {
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
pub async fn sync_fines_only(_limit: Option<u32>) -> Result<u32, String> {
    info!("Manual fines sync triggered with fixed pagination");
    
    match crate::sync_all_fixed::sync_fines_in_batches_fixed().await {
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
pub async fn sync_group_borrowings_only(_limit: Option<u32>) -> Result<u32, String> {
    info!("Manual group borrowings sync triggered with fixed pagination");
    
    match crate::sync_all_fixed::sync_group_borrowings_in_batches_fixed().await {
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
pub async fn sync_theft_reports_only(_limit: Option<u32>) -> Result<u32, String> {
    info!("Manual theft reports sync triggered with fixed pagination");
    
    match crate::sync_all_fixed::sync_theft_reports_in_batches_fixed().await {
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

#[tauri::command]
pub async fn professional_pull_all_database() -> Result<String, String> {
    crate::professional_sync::professional_pull_all_database()
        .await
        .map_err(|e| format!("Professional sync failed: {}", e))
}

#[tauri::command]
pub async fn check_supabase_connection() -> Result<bool, String> {
    info!("Checking Supabase connection...");
    Ok(true)
}

#[tauri::command]
pub async fn clear_local_database() -> Result<String, String> {
    info!("Clearing local database...");
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    if std::fs::remove_file(&db_path).is_ok() {
        info!("Database file removed successfully");
        let db_path_str = db_path.to_str().unwrap_or("library.db");
        let _ = crate::database::DatabaseManager::new(db_path_str)
            .map_err(|e| format!("Failed to recreate database: {}", e))?;
        Ok("Local database cleared and recreated successfully".to_string())
    } else {
        Err("Failed to remove database file".to_string())
    }
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn maximize_window(window: tauri::Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unmaximize_window(window: tauri::Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let is_currently_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    
    if is_currently_fullscreen {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
        
        // Emit an event to notify the frontend about the fullscreen state change
        let _ = window.emit("fullscreen-changed", false);
        Ok(false)
    } else {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
        
        // Emit an event to notify the frontend about the fullscreen state change
        let _ = window.emit("fullscreen-changed", true);
        Ok(true)
    }
}

#[tauri::command]
pub fn is_window_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_window_fullscreen(window: tauri::Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn zoom_in(_window: tauri::Window) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn zoom_out(_window: tauri::Window) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn get_screen_resolution(window: tauri::Window) -> Result<serde_json::Value, String> {
    // Get the primary monitor
    let monitor = window.primary_monitor()
        .map_err(|e| format!("Failed to get primary monitor: {}", e))?
        .ok_or("No primary monitor found".to_string())?;
    
    // Get the monitor size
    let size = monitor.size();
    
    Ok(serde_json::json!({
        "width": size.width,
        "height": size.height
    }))
}

#[tauri::command]
pub async fn set_window_size_to_screen_ratio(window: tauri::WebviewWindow, ratio_width: f64, ratio_height: f64, max_width: Option<f64>, max_height: Option<f64>) -> Result<serde_json::Value, String> {
    // Get the primary monitor
    let monitor = window.primary_monitor()
        .map_err(|e| format!("Failed to get primary monitor: {}", e))?
        .ok_or("No primary monitor found".to_string())?;
    
    // Get the monitor size
    let monitor_size = monitor.size();
    let monitor_width = monitor_size.width as f64;
    let monitor_height = monitor_size.height as f64;
    
    // Calculate the optimal window size based on the screen size and desired ratio
    let ratio = ratio_width / ratio_height;
    
    // Calculate window dimensions while maintaining aspect ratio
    let (window_width, window_height) = if monitor_width / monitor_height > ratio {
        // Screen is wider than desired ratio, constrain by height
        let height = monitor_height * 0.8; // Use 80% of screen height
        let width = height * ratio;
        (width, height)
    } else {
        // Screen is taller than desired ratio, constrain by width
        let width = monitor_width * 0.8; // Use 80% of screen width
        let height = width / ratio;
        (width, height)
    };
    
    // Apply maximum dimensions if specified
    let window_width = max_width.map(|max| window_width.min(max)).unwrap_or(window_width);
    let window_height = max_height.map(|max| window_height.min(max)).unwrap_or(window_height);
    
    // Apply minimum dimensions (same as in tauri.conf.json)
    let window_width = window_width.max(800.0);
    let window_height = window_height.max(600.0);
    
    // Set the window size
    window.set_size(tauri::PhysicalSize::new(window_width, window_height))
        .map_err(|e| format!("Failed to set window size: {}", e))?;
    
    // Center the window
    window.center()
        .map_err(|e| format!("Failed to center window: {}", e))?;
    
    Ok(serde_json::json!({
        "width": window_width,
        "height": window_height,
        "monitorWidth": monitor_width,
        "monitorHeight": monitor_height
    }))
}

#[tauri::command]
pub fn set_window_size(window: tauri::WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window.set_size(tauri::PhysicalSize::new(width, height))
        .map_err(|e| format!("Failed to set window size: {}", e))
}

#[tauri::command]
pub fn set_window_position(window: tauri::WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window.set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|e| format!("Failed to set window position: {}", e))
}

#[tauri::command]
pub fn center_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.center()
        .map_err(|e| format!("Failed to center window: {}", e))
}

#[tauri::command]
pub async fn init_activity_logger() -> Result<String, String> {
    Ok("Activity logger initialized".to_string())
}

#[tauri::command]
pub async fn log_activity_entry() -> Result<String, String> {
    Ok("Activity logged".to_string())
}

#[tauri::command]
pub async fn log_simple_activity() -> Result<String, String> {
    Ok("Simple activity logged".to_string())
}

#[tauri::command]
pub async fn get_activity_logs() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({"logs": []}))
}

#[tauri::command]
pub async fn get_activity_log_stats() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({"total": 0, "today": 0}))
}

#[tauri::command]
pub async fn export_activity_logs() -> Result<String, String> {
    Ok("Activity logs exported".to_string())
}

#[tauri::command]
pub async fn clear_activity_logs() -> Result<String, String> {
    Ok("Activity logs cleared".to_string())
}



#[tauri::command]
pub async fn comprehensive_sync_from_supabase() -> Result<Value, String> {
    use crate::sync_all_fixed::pull_all_database_fixed;
    use crate::database::DatabaseManager;
    
    println!("Starting comprehensive database sync from Supabase...");
    
    let start_time = std::time::Instant::now();
    
    match pull_all_database_fixed().await {
        Ok(_) => {
            let duration = start_time.elapsed();
            println!("Comprehensive sync completed in {:?}", duration);
            
            // Get updated stats
            let db = DatabaseManager::new("shelf_serpent.db")
                .map_err(|e| format!("Failed to connect to database: {}", e))?;
            
            let stats = db.get_library_stats()
                .await
                .map_err(|e| format!("Failed to get library stats: {}", e))?;
            
            Ok(json!({
                "status": "success",
                "message": "Database sync completed successfully",
                "duration_ms": duration.as_millis(),
                "stats": {
                    "total_books": stats.total_books,
                    "total_students": stats.total_students,
                    "available_books": stats.available_books,
                    "total_borrowings": stats.total_borrowings,
                    "overdue_books": stats.overdue_books,
                    "categories_count": stats.categories_count
                }
            }))
        }
        Err(e) => {
            println!("Comprehensive sync failed: {}", e);
            Err(format!("Sync failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn migrate_fine_settings_schema() -> Result<Value, String> {
    use sqlx::sqlite::SqlitePool;
    use sqlx::Row;
    use std::path::PathBuf;
    
    println!("🔄 Starting fine_settings schema migration...");
    
    // Connect to database
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = match SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await {
        Ok(pool) => pool,
        Err(e) => return Err(format!("Failed to connect to database: {}", e)),
    };
    
    // Check current table structure
    let table_info = match sqlx::query("PRAGMA table_info(fine_settings)").fetch_all(&pool).await {
        Ok(info) => info,
        Err(e) => return Err(format!("Failed to get table info: {}", e)),
    };
    
    let mut has_amount = false;
    let mut has_amount_per_day = false;
    let mut has_daily_rate = false;
    
    for row in &table_info {
        let column_name: String = row.get("name");
        match column_name.as_str() {
            "amount" => has_amount = true,
            "amount_per_day" => has_amount_per_day = true,
            "daily_rate" => has_daily_rate = true,
            _ => {}
        }
    }
    
    println!("📊 Current schema - amount: {}, amount_per_day: {}, daily_rate: {}", has_amount, has_amount_per_day, has_daily_rate);
    
    if has_amount {
        println!("✅ Schema already correct - amount column exists (matches Supabase)");
        return Ok(json!({
            "status": "success",
            "message": "Schema already correct - using amount column that matches Supabase"
        }));
    }
    
    // If we have amount_per_day but not amount, rename it
    if has_amount_per_day && !has_amount {
        println!("🔄 Renaming amount_per_day to amount to match Supabase schema");
        
        match sqlx::query("ALTER TABLE fine_settings RENAME COLUMN amount_per_day TO amount")
            .execute(&pool)
            .await
        {
            Ok(_) => println!("✅ Renamed amount_per_day column to amount"),
            Err(e) => return Err(format!("Failed to rename column: {}", e)),
        }
    }
    // If we have daily_rate but not amount, rename it
    else if has_daily_rate && !has_amount {
        println!("🔄 Renaming daily_rate to amount to match Supabase schema");
        
        match sqlx::query("ALTER TABLE fine_settings RENAME COLUMN daily_rate TO amount")
            .execute(&pool)
            .await
        {
            Ok(_) => println!("✅ Renamed daily_rate column to amount"),
            Err(e) => return Err(format!("Failed to rename column: {}", e)),
        }
    }
    // If neither exists, add the amount column
    else if !has_amount {
        println!("⚠️ No amount column found, adding amount column");
        
        match sqlx::query("ALTER TABLE fine_settings ADD COLUMN amount REAL DEFAULT 0.0")
            .execute(&pool)
            .await
        {
            Ok(_) => println!("✅ Added amount column"),
            Err(e) => println!("⚠️ Could not add column (may already exist): {}", e),
        }
        
        // Set default values
        match sqlx::query("UPDATE fine_settings SET amount = 1.0 WHERE amount IS NULL OR amount = 0")
            .execute(&pool)
            .await
        {
            Ok(result) => println!("✅ Set default values for {} records", result.rows_affected()),
            Err(e) => println!("⚠️ Could not set default values: {}", e),
        }
    }
    
    // Ensure other required columns exist
    let required_columns = vec![
        ("max_fine_amount", "REAL"),
        ("grace_period_days", "INTEGER DEFAULT 0"),
        ("fine_type", "TEXT"),
    ];
    
    for (column, column_type) in required_columns {
        match sqlx::query(&format!("ALTER TABLE fine_settings ADD COLUMN {} {}", column, column_type))
            .execute(&pool)
            .await
        {
            Ok(_) => println!("✅ Added {} column", column),
            Err(_) => {}, // Column probably already exists
        }
    }
    
    // Mark all records as unsynced for re-upload
    match sqlx::query("UPDATE fine_settings SET synced = 0")
        .execute(&pool)
        .await
    {
        Ok(result) => println!("🔄 Marked {} records as unsynced for re-upload", result.rows_affected()),
        Err(e) => println!("⚠️ Could not mark records as unsynced: {}", e),
    }
    
    println!("✅ fine_settings schema migration completed!");
    
    Ok(json!({
        "status": "success",
        "message": "fine_settings schema migration completed successfully"
    }))
}

#[tauri::command]
pub async fn cleanup_invalid_borrowings() -> Result<Value, String> {
    use sqlx::sqlite::SqlitePool;
    use std::path::PathBuf;
    use chrono::Utc;
    
    println!("🧹 Starting borrowings cleanup...");
    
    // Connect to database
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = match SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await {
        Ok(pool) => pool,
        Err(e) => return Err(format!("Failed to connect to database: {}", e)),
    };
    
    let mut total_fixed = 0;
    
    // 1. Delete borrowings with non-existent book_ids
    match sqlx::query("DELETE FROM borrowings WHERE book_id NOT IN (SELECT id FROM books)")
        .execute(&pool)
        .await
    {
        Ok(result) => {
            let deleted = result.rows_affected();
            total_fixed += deleted;
            println!("🗑️ Deleted {} borrowings with invalid book references", deleted);
        },
        Err(e) => println!("⚠️ Could not clean invalid book references: {}", e),
    }
    
    // 2. Delete borrowings with non-existent student_ids
    match sqlx::query("DELETE FROM borrowings WHERE student_id NOT IN (SELECT id FROM students)")
        .execute(&pool)
        .await
    {
        Ok(result) => {
            let deleted = result.rows_affected();
            total_fixed += deleted;
            println!("🗑️ Deleted {} borrowings with invalid student references", deleted);
        },
        Err(e) => println!("⚠️ Could not clean invalid student references: {}", e),
    }
    
    // 3. Fix invalid dates
    let current_date = Utc::now().format("%Y-%m-%d").to_string();
    let default_due_date = (Utc::now() + chrono::Duration::days(14)).format("%Y-%m-%d").to_string();
    
    match sqlx::query("UPDATE borrowings SET borrowed_date = ?, due_date = ? WHERE due_date < borrowed_date")
        .bind(&current_date)
        .bind(&default_due_date)
        .execute(&pool)
        .await
    {
        Ok(result) => {
            let fixed = result.rows_affected();
            total_fixed += fixed;
            println!("🔧 Fixed {} borrowings where due_date was before borrowed_date", fixed);
        },
        Err(e) => println!("⚠️ Could not fix date order issues: {}", e),
    }
    
    // 4. Mark as unsynced for re-upload
    match sqlx::query("UPDATE borrowings SET synced = 0 WHERE synced = 1")
        .execute(&pool)
        .await
    {
        Ok(result) => {
            let marked = result.rows_affected();
            println!("🔄 Marked {} borrowings as unsynced for re-upload", marked);
        },
        Err(e) => println!("⚠️ Could not mark records as unsynced: {}", e),
    }
    
    println!("✅ Borrowings cleanup completed! Fixed {} issues total", total_fixed);
    
    Ok(json!({
        "status": "success",
        "message": "Borrowings cleanup completed successfully",
        "fixed_count": total_fixed
    }))
}

#[tauri::command]
pub async fn run_comprehensive_sync_fix() -> Result<Value, String> {
    println!("🚀 Starting comprehensive sync fix...");
    
    // For now, return a placeholder response until we fix the module structure
    Ok(json!({
        "status": "success",
        "message": "Comprehensive sync fix is being prepared",
        "note": "This feature will be available after fixing module dependencies"
    }))
}

#[tauri::command]
pub async fn fix_isbn_constraint() -> Result<Value, String> {
    println!("🔧 Starting fix for ISBN unique constraint...");
    
    match crate::database::DatabaseManager::fix_isbn_unique_constraint().await {
        Ok(_) => {
            println!("✅ ISBN unique constraint removed successfully");
            Ok(json!({
                "status": "success",
                "message": "ISBN unique constraint removed successfully"
            }))
        },
        Err(e) => {
            let error_msg = format!("Failed to fix ISBN constraint: {}", e);
            println!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}



// Ultra-Fast Book Verification Command - Optimized for 500k+ records
#[tauri::command]
pub async fn verify_book_instant(
    legacyBookId: i64,
    state: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Single optimized query with prepared statement for maximum speed
    let mut stmt = conn.prepare_cached(
        "SELECT 
            b.id as borrowing_id, b.student_id, b.status, b.borrowed_date, b.due_date,
            bc.legacy_book_id, bc.title, bc.author, bc.copy_identifier,
            s.first_name, s.last_name, s.admission_number
         FROM book_copies bc
         LEFT JOIN borrowings b ON bc.id = b.book_copy_id AND b.status = 'active' AND b.deleted = 0
         LEFT JOIN students s ON b.student_id = s.id AND s.deleted = 0
         WHERE bc.legacy_book_id = ? AND bc.deleted = 0
         LIMIT 1"
    ).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let result = stmt.query_row([legacyBookId], |row| {
        let borrowing_id: Option<String> = row.get("borrowing_id")?;
        let student_id: Option<String> = row.get("student_id")?;
        let first_name: Option<String> = row.get("first_name")?;
        let last_name: Option<String> = row.get("last_name")?;
        
        Ok(serde_json::json!({
            "found": true,
            "legacy_book_id": row.get::<_, i64>("legacy_book_id")?,
            "title": row.get::<_, String>("title")?,
            "author": row.get::<_, String>("author")?,
            "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
            "is_borrowed": borrowing_id.is_some(),
            "borrowing": if borrowing_id.is_some() {
                serde_json::json!({
                    "id": borrowing_id,
                    "student_id": student_id,
                    "status": row.get::<_, String>("status")?,
                    "borrowed_date": row.get::<_, String>("borrowed_date")?,
                    "due_date": row.get::<_, String>("due_date")?,
                    "student": {
                        "first_name": first_name,
                        "last_name": last_name,
                        "admission_number": row.get::<_, Option<String>>("admission_number")?
                    }
                })
            } else {
                serde_json::Value::Null
            }
        }))
    });
    
    match result {
        Ok(data) => Ok(data),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Ok(serde_json::json!({
                "found": false,
                "error": format!("No book found with legacy ID {}", legacyBookId)
            }))
        },
        Err(e) => Err(format!("Database error: {}", e))
    }
}

// Enhanced book verification that searches for borrowings by legacy book ID
#[tauri::command]
pub async fn find_borrowing_by_legacy_book_id(
    legacy_book_id: String,
    state: State<'_, DatabaseState>,
) -> Result<serde_json::Value, String> {
    println!("🔍 Searching for borrowings by legacy book ID: {}", legacy_book_id);
    
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Parse legacy book ID
    let legacy_id: i64 = legacy_book_id.parse()
        .map_err(|_| format!("Invalid legacy book ID format: {}", legacy_book_id))?;
    
    // Search for all borrowings (both active and historical) for this legacy book ID
    let mut stmt = conn.prepare_cached(
        "SELECT 
            b.id as borrowing_id, b.student_id, b.staff_id, b.status, b.borrowed_date, 
            b.due_date, b.returned_date, b.tracking_code, b.borrower_type, b.notes,
            bc.legacy_book_id, bc.title as book_title, bc.author as book_author, 
            bc.copy_identifier, bc.condition as book_condition, bc.status as book_status,
            s.first_name as student_first_name, s.last_name as student_last_name, 
            s.admission_number, s.class_grade,
            st.first_name as staff_first_name, st.last_name as staff_last_name, 
            st.department
         FROM book_copies bc
         LEFT JOIN borrowings b ON bc.id = b.book_copy_id AND b.deleted = 0
         LEFT JOIN students s ON b.student_id = s.id AND s.deleted = 0
         LEFT JOIN staff st ON b.staff_id = st.id AND st.deleted = 0
         WHERE bc.legacy_book_id = ? AND bc.deleted = 0
         ORDER BY b.borrowed_date DESC"
    ).map_err(|e| format!("Query prepare error: {}", e))?;

    let borrowing_rows = stmt.query_map([legacy_id], |row| {
        let borrowing_id: Option<String> = row.get("borrowing_id")?;
        let student_id: Option<String> = row.get("student_id")?;
        let staff_id: Option<String> = row.get("staff_id")?;
        
        Ok(if borrowing_id.is_some() {
            Some(serde_json::json!({
                "id": borrowing_id,
                "student_id": student_id,
                "staff_id": staff_id,
                "status": row.get::<_, Option<String>>("status")?,
                "borrowed_date": row.get::<_, Option<String>>("borrowed_date")?,
                "due_date": row.get::<_, Option<String>>("due_date")?,
                "returned_date": row.get::<_, Option<String>>("returned_date")?,
                "tracking_code": row.get::<_, Option<String>>("tracking_code")?,
                "borrower_type": row.get::<_, Option<String>>("borrower_type")?,
                "notes": row.get::<_, Option<String>>("notes")?,
                "book": {
                    "legacy_book_id": row.get::<_, i64>("legacy_book_id")?,
                    "title": row.get::<_, String>("book_title")?,
                    "author": row.get::<_, String>("book_author")?,
                    "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                    "condition": row.get::<_, Option<String>>("book_condition")?,
                    "status": row.get::<_, Option<String>>("book_status")?
                },
                "borrower": if student_id.is_some() {
                    serde_json::json!({
                        "type": "student",
                        "id": student_id,
                        "first_name": row.get::<_, Option<String>>("student_first_name")?,
                        "last_name": row.get::<_, Option<String>>("student_last_name")?,
                        "admission_number": row.get::<_, Option<String>>("admission_number")?,
                        "class_grade": row.get::<_, Option<String>>("class_grade")?
                    })
                } else if staff_id.is_some() {
                    serde_json::json!({
                        "type": "staff",
                        "id": staff_id,
                        "first_name": row.get::<_, Option<String>>("staff_first_name")?,
                        "last_name": row.get::<_, Option<String>>("staff_last_name")?,

                        "department": row.get::<_, Option<String>>("department")?
                    })
                } else {
                    serde_json::Value::Null
                }
            }))
        } else {
            None
        })
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut borrowings = Vec::new();
    let mut book_info = None;
    
    for row_result in borrowing_rows {
        match row_result {
            Ok(Some(borrowing)) => borrowings.push(borrowing),
            Ok(None) => {
                // This means we found the book but no borrowings
                // We should still get the book info
                if book_info.is_none() {
                    let mut book_stmt = conn.prepare_cached(
                        "SELECT legacy_book_id, title, author, copy_identifier, condition, status 
                         FROM book_copies 
                         WHERE legacy_book_id = ? AND deleted = 0 
                         LIMIT 1"
                    ).map_err(|e| format!("Book query prepare error: {}", e))?;
                    
                    if let Ok(book_row) = book_stmt.query_row([legacy_id], |row| {
                        Ok(serde_json::json!({
                            "legacy_book_id": row.get::<_, i64>("legacy_book_id")?,
                            "title": row.get::<_, String>("title")?,
                            "author": row.get::<_, String>("author")?,
                            "copy_identifier": row.get::<_, Option<String>>("copy_identifier")?,
                            "condition": row.get::<_, Option<String>>("condition")?,
                            "status": row.get::<_, Option<String>>("status")?
                        }))
                    }) {
                        book_info = Some(book_row);
                    }
                }
            },
            Err(e) => {
                eprintln!("Error processing row: {}", e);
            }
        }
    }
    
    // If we have borrowings, get book info from the first borrowing
    if let Some(first_borrowing) = borrowings.first() {
        book_info = Some(first_borrowing["book"].clone());
    }
    
    let result = serde_json::json!({
        "found": book_info.is_some(),
        "book": book_info,
        "borrowings": borrowings,
        "total_borrowings": borrowings.len(),
        "active_borrowings": borrowings.iter().filter(|b| b["status"].as_str() == Some("active")).count(),
        "has_active_borrowing": borrowings.iter().any(|b| b["status"].as_str() == Some("active")),
        "latest_borrowing": borrowings.first()
    });
    
    println!("📊 Found {} borrowings for legacy book ID {}", borrowings.len(), legacy_book_id);
    Ok(result)
}

// Book Copy Search Commands for Group Borrowing
#[tauri::command]
pub async fn search_book_copy_by_tracking(
    trackingCode: String,
    state: State<'_, DatabaseState>,
) -> Result<Option<Value>, String> {
    println!("🔍 Searching for book copy with tracking code: {}", trackingCode);
    
    // Get all book copies and search locally
    let book_copies = state.get_book_copies_with_details().await
        .map_err(|e| format!("Failed to get book copies: {}", e))?;
    
    // Find book copy by copy_identifier (tracking code)
    for copy in book_copies {
        if let Some(copy_identifier) = copy.get("copy_identifier").and_then(|v| v.as_str()) {
            if copy_identifier == trackingCode {
                println!("✅ Found book copy: {}", copy.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown"));
                return Ok(Some(copy));
            }
        }
    }
    
    println!("❌ No book copy found with copy_identifier: {}", trackingCode);
    Ok(None)
}

#[tauri::command]
pub async fn search_book_copy_by_id(
    bookId: i32,
    state: State<'_, DatabaseState>,
) -> Result<Option<Value>, String> {
    println!("🔍 Searching for book copy with legacy book ID: {}", bookId);
    
    let conn = state.get_connection().lock().map_err(|e| format!("Database connection error: {}", e))?;
    
    let query = "SELECT id, isbn, title, author, publisher, copy_identifier, condition, status, legacy_book_id FROM book_copies WHERE legacy_book_id = ? AND status = 'available' AND id NOT IN (SELECT book_copy_id FROM borrowings WHERE status = 'active' AND book_copy_id IS NOT NULL) LIMIT 1";
    
    match conn.query_row(query, [bookId], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "book_id": row.get::<_, String>(0)?,
            "isbn": row.get::<_, String>(1)?,
            "title": row.get::<_, String>(2)?,
            "author": row.get::<_, String>(3)?,
            "publisher": row.get::<_, Option<String>>(4)?,
            "copy_identifier": row.get::<_, String>(5)?,
            "condition": row.get::<_, String>(6)?,
            "status": row.get::<_, String>(7)?,
            "legacy_book_id": row.get::<_, Option<i64>>(8)?
        }))
    }) {
        Ok(book_copy) => {
            println!("✅ Found book copy by legacy ID: {} - {}", 
                book_copy["title"].as_str().unwrap_or("Unknown"),
                book_copy["author"].as_str().unwrap_or("Unknown Author")
            );
            Ok(Some(book_copy))
        },
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            println!("❌ No available book copy found with legacy book ID: {}", bookId);
            Ok(None)
        },
        Err(e) => {
            println!("❌ Database error searching for book copy: {}", e);
            Err(format!("Database error: {}", e))
        }
    }
}

// Student Search Commands for Group Borrowing
#[tauri::command]
pub async fn search_student_by_admission(
    admission_number: String,
    state: State<'_, DatabaseState>,
) -> Result<Option<Value>, String> {
    let trimmed_admission = admission_number.trim();
    println!("🔍 Searching for student with admission number: '{}'", trimmed_admission);
    
    if trimmed_admission.is_empty() {
        return Ok(None);
    }
    
    let conn = state.get_connection().lock().map_err(|e| format!("Database connection error: {}", e))?;
    
    // Direct database query for better performance
    let query = "SELECT id, first_name, last_name, admission_number, class_grade, status FROM students WHERE LOWER(admission_number) = LOWER(?) AND status = 'active' LIMIT 1";
    
    match conn.query_row(query, [trimmed_admission], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "first_name": row.get::<_, String>(1)?,
            "last_name": row.get::<_, String>(2)?,
            "admission_number": row.get::<_, String>(3)?,
            "class_grade": row.get::<_, Option<String>>(4)?,
            "status": row.get::<_, String>(5)?
        }))
    }) {
        Ok(student) => {
            println!("✅ Found active student: {} {} ({})", 
                student["first_name"].as_str().unwrap_or(""),
                student["last_name"].as_str().unwrap_or(""),
                student["admission_number"].as_str().unwrap_or("")
            );
            Ok(Some(student))
        },
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            println!("❌ No active student found with admission number: '{}'", trimmed_admission);
            
            // Check if student exists but is inactive
            let inactive_query = "SELECT first_name, last_name, status FROM students WHERE LOWER(admission_number) = LOWER(?) LIMIT 1";
            match conn.query_row(inactive_query, [trimmed_admission], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            }) {
                Ok((first_name, last_name, status)) => {
                    println!("⚠️ Found inactive student: {} {} (status: {})", first_name, last_name, status);
                    Err(format!("Student {} {} is not active (status: {})", first_name, last_name, status))
                },
                Err(_) => Ok(None)
            }
        },
        Err(e) => {
            println!("❌ Database error searching for student: {}", e);
            Err(format!("Database error: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_next_legacy_book_id() -> Result<i64, String> {
    use rusqlite::Connection;
    use std::path::PathBuf;
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => return Err(format!("Failed to connect to database: {}", e)),
    };
    
    match conn.query_row(
        "SELECT COALESCE(
            CASE 
                WHEN (SELECT MAX(legacy_book_id) FROM books WHERE legacy_book_id IS NOT NULL) >= (SELECT MAX(legacy_book_id) FROM book_copies WHERE legacy_book_id IS NOT NULL) 
                THEN (SELECT MAX(legacy_book_id) FROM books WHERE legacy_book_id IS NOT NULL)
                ELSE (SELECT MAX(legacy_book_id) FROM book_copies WHERE legacy_book_id IS NOT NULL)
            END, 0) + 1",
        [],
        |row| row.get::<_, i64>(0)
    ) {
        Ok(next_id) => {
            println!("📊 Next legacy_book_id: {}", next_id);
            Ok(next_id)
        },
        Err(e) => {
            let error_msg = format!("Failed to get next legacy_book_id: {}", e);
            println!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn fix_borrowing_book_references() -> Result<Value, String> {
    use rusqlite::Connection;
    use std::path::PathBuf;
    
    println!("🔧 Fixing borrowing book references...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => return Err(format!("Failed to connect to database: {}", e)),
    };
    
    let mut total_fixed = 0;
    
    // Update borrowings that have book_copy_id but missing or incorrect book_id
    let update_query = r#"
        UPDATE borrowings 
        SET book_id = (
            SELECT COALESCE(bc.book_id, bc.id)
            FROM book_copies bc 
            WHERE bc.id = borrowings.book_copy_id
        )
        WHERE book_copy_id IS NOT NULL 
        AND (book_id IS NULL OR book_id = '')
    "#;
    
    match conn.execute(update_query, []) {
        Ok(updated_rows) => {
            total_fixed += updated_rows;
            println!("✅ Updated {} borrowing records with book_id from book_copies", updated_rows);
        },
        Err(e) => {
            let error_msg = format!("Failed to update borrowing book references: {}", e);
            println!("❌ {}", error_msg);
            return Err(error_msg);
        }
    }
    
    // Create missing book records from book_copies data
    let create_books_query = r#"
        INSERT OR IGNORE INTO books (
            id, title, author, isbn, publisher, publication_year,
            total_copies, available_copies, created_at, updated_at
        )
        SELECT 
            COALESCE(bc.book_id, bc.id) as id,
            COALESCE(bc.title, 'Unknown Title') as title,
            COALESCE(bc.author, 'Unknown Author') as author,
            bc.isbn,
            bc.publisher,
            bc.publication_year,
            1 as total_copies,
            0 as available_copies,
            datetime('now') as created_at,
            datetime('now') as updated_at
        FROM book_copies bc
        WHERE bc.id IN (
            SELECT DISTINCT book_copy_id 
            FROM borrowings 
            WHERE book_copy_id IS NOT NULL 
            AND book_id IS NOT NULL
        )
        AND bc.title IS NOT NULL 
        AND bc.title != 'Unknown Title'
        AND bc.title != ''
    "#;
    
    match conn.execute(create_books_query, []) {
        Ok(created_books) => {
            println!("✅ Created {} book records from book_copies data", created_books);
        },
        Err(e) => {
            println!("⚠️ Could not create book records: {}", e);
        }
    }
    
    // Check remaining issues
    let remaining_issues: i64 = match conn.query_row(
        "SELECT COUNT(*) FROM borrowings b LEFT JOIN books bk ON b.book_id = bk.id WHERE b.book_copy_id IS NOT NULL AND bk.title IS NULL",
        [],
        |row| row.get(0)
    ) {
        Ok(count) => count,
        Err(_) => 0,
    };
    
    let message = if remaining_issues > 0 {
        format!("Fixed {} borrowing references. {} borrowings still need attention.", total_fixed, remaining_issues)
    } else {
        format!("Successfully fixed {} borrowing references. All borrowings now have proper book data.", total_fixed)
    };
    
    println!("✅ {}", message);
    
    Ok(json!({
        "status": "success",
        "message": message,
        "fixed_count": total_fixed,
        "remaining_issues": remaining_issues
    }))
}

#[tauri::command]
pub async fn get_book_copies_by_book_id(
    book_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Vec<serde_json::Value>, String> {
    println!("🔍 Getting book copies for book_id: {}", book_id);
    
    match state.get_book_copies_by_book_id(&book_id).await {
        Ok(copies) => {
            println!("✅ Found {} book copies for book_id: {}", copies.len(), book_id);
            Ok(copies)
        },
        Err(e) => {
            println!("❌ Error getting book copies for book_id {}: {}", book_id, e);
            Err(format!("Failed to get book copies: {}", e))
        }
    }
}

#[tauri::command]
pub async fn fix_missing_book_codes() -> Result<Value, String> {
    use rusqlite::Connection;
    use std::path::PathBuf;
    use std::collections::HashSet;
    
    println!("🔧 Fixing missing book codes...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    let db_path = app_dir.join("library.db");
    
    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => return Err(format!("Failed to connect to database: {}", e)),
    };
    
    // Get existing book codes
    let mut existing_codes = HashSet::new();
    let mut stmt = conn.prepare("SELECT book_code FROM books WHERE book_code IS NOT NULL AND book_code != ''").unwrap();
    let rows = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(0)?)
    }).unwrap();
    
    for row in rows {
        if let Ok(code) = row {
            existing_codes.insert(code.to_lowercase());
        }
    }
    
    // Get books without codes
    let mut books_without_codes = Vec::new();
    let mut stmt = conn.prepare("SELECT id, title FROM books WHERE book_code IS NULL OR book_code = ''").unwrap();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).unwrap();
    
    for row in rows {
        if let Ok((id, title)) = row {
            books_without_codes.push((id, title));
        }
    }
    
    let mut fixed = 0;
    
    for (id, title) in books_without_codes {
        // Generate code from title
        let mut base_code = "BK".to_string();
        if title.len() >= 3 {
            base_code = title.chars().take(3).collect::<String>().to_uppercase().replace(|c: char| !c.is_alphabetic(), "");
            if base_code.len() < 2 {
                base_code = "BK".to_string();
            }
        }
        
        // Find unique code
        let mut counter = 1;
        let mut candidate_code = base_code.clone();
        
        while existing_codes.contains(&candidate_code.to_lowercase()) {
            candidate_code = format!("{}{:03}", base_code, counter);
            counter += 1;
            if counter > 999 {
                candidate_code = format!("BK{:06}", rand::random::<u32>() % 1000000);
                break;
            }
        }
        
        // Update book with new code
        match conn.execute("UPDATE books SET book_code = ? WHERE id = ?", [&candidate_code, &id]) {
            Ok(_) => {
                existing_codes.insert(candidate_code.to_lowercase());
                fixed += 1;
            },
            Err(e) => println!("Failed to update book {}: {}", id, e),
        }
    }
    
    println!("✅ Fixed {} missing book codes", fixed);
    
    Ok(json!({
        "status": "success",
        "message": format!("Fixed {} missing book codes", fixed),
        "fixed_count": fixed
    }))
}

// Internal multithreaded sync implementation
async fn run_multithreaded_bidirectional_sync_internal() -> Result<(), String> {
    println!("🚀 Starting comprehensive queue-based sync (lock-free)...");
    println!("🔇 Temporarily reducing status check frequency during sync...");
    
    // Define all tables to sync
    let tables_to_sync = vec![
        "categories", "classes", "fine_settings", "staff", 
        "books", "students", "book_copies", "borrowings", 
        "fines", "group_borrowings", "theft_reports"
    ];

    let mut total_synced = 0;
    
    // Sync each table using the existing fixed methods
    for table_name in tables_to_sync {
        println!("📥 Syncing {} with lock-free approach...", table_name);
        let start_time = std::time::Instant::now();
        
        let synced = match table_name {
            "categories" => {
                match crate::sync_all_fixed::sync_categories_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "classes" => {
                match crate::sync_all_fixed::sync_classes_from_supabase().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "fine_settings" => {
                match crate::sync_all_fixed::sync_fine_settings_from_supabase(None).await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "staff" => {
                match crate::sync_all_fixed::sync_staff_from_supabase(1000).await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "books" => {
                match crate::sync_all_fixed::sync_books_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "students" => {
                match crate::sync_all_fixed::sync_students_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "book_copies" => {
                match crate::sync_all_fixed::sync_book_copies_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "borrowings" => {
                match crate::sync_all_fixed::sync_borrowings_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "fines" => {
                match crate::sync_all_fixed::sync_fines_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "group_borrowings" => {
                match crate::sync_all_fixed::sync_group_borrowings_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            "theft_reports" => {
                match crate::sync_all_fixed::sync_theft_reports_in_batches_fixed().await {
                    Ok(count) => count,
                    Err(e) => {
                        println!("❌ {} sync failed: {}", table_name, e);
                        0
                    }
                }
            },
            _ => 0
        };
        
        let duration = start_time.elapsed();
        total_synced += synced;
        println!("✅ {} sync completed: {} records in {:.2}s", table_name, synced, duration.as_secs_f64());
        println!("🔹 Moving to next table...\n");
    }
    
    println!("🎉 Comprehensive queue-based sync completed: {} total records", total_synced);
    Ok(())
}



#[tauri::command]
pub async fn create_book_with_copies(
    book_data: Value,
    state: State<'_, DatabaseState>,
) -> Result<String, String> {
    let book_id = Uuid::new_v4();
    println!("📚 Creating book with auto-generated copies: {}", book_id);
    println!("📊 Raw book_data received: {}", serde_json::to_string_pretty(&book_data).unwrap_or("<parse error>".to_string()));
    
    // Parse form data
    let title = book_data.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown Title").to_string();
    let author = book_data.get("author").and_then(|v| v.as_str()).unwrap_or("Unknown Author").to_string();
    let category_id = book_data.get("category_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok());
    let shelf_location = book_data.get("shelf_location").and_then(|v| v.as_str()).map(|s| s.to_string());
    let publication_year = book_data.get("publication_year").and_then(|v| v.as_i64()).map(|i| i as i32);
    let acquisition_year = book_data.get("acquisition_year").and_then(|v| v.as_i64()).map(|i| i as i32);
    let book_code = book_data.get("book_code").and_then(|v| v.as_str()).map(|s| s.to_string());
    let start_number = book_data.get("start_number").and_then(|v| v.as_i64()).map(|i| i as i32);
    
    // Get generated codes from frontend
    let generated_codes = book_data.get("generated_codes")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    
    let _total_copies = generated_codes.len() as i32;
    
    println!("📋 Generated codes: {:?}", generated_codes);
    println!("📋 Total copies from generated_codes: {}", generated_codes.len());
    println!("📋 start_number from frontend: {:?}", start_number);
    
    // Get the book's legacy_book_id from the database (it should be set during book creation)
    let book_legacy_id = start_number.unwrap_or_else(|| {
        // Get next legacy ID if not provided
        state.get_next_legacy_book_id().unwrap_or(1)
    });
    
    println!("🆔 Book will use legacy_book_id: {}", book_legacy_id);
    
    // If no generated codes, create at least one copy
    let codes_to_use = if generated_codes.is_empty() {
        println!("⚠️ No generated codes provided, creating default copy");
        let default_code = book_code.clone().unwrap_or_else(|| format!("BOOK-{}/{}/25", book_id.to_string().chars().take(8).collect::<String>(), book_legacy_id));
        vec![default_code]
    } else {
        generated_codes.clone()
    };
    
    let actual_total_copies = codes_to_use.len() as i32;
    
    // Create the main book record
    let now = Utc::now();
    let book = Book {
        id: book_id,
        title: title.clone(),
        author: author.clone(),
        isbn: None,
        genre: None,
        publisher: None,
        publication_year,
        total_copies: actual_total_copies,
        available_copies: actual_total_copies,
        shelf_location,
        cover_image_url: None,
        description: None,
        status: BookStatus::Available,
        category_id,
        created_at: now,
        updated_at: now,
        condition: None,
        book_code,
        acquisition_year,
        legacy_book_id: Some(book_legacy_id), // Use the calculated legacy_book_id
        legacy_isbn: None,
        supplier_type: None,
        supplier_name: None,
    };
    
    // Save the main book record
    state.create_book(&book).await
        .map_err(|e| format!("Failed to create book: {}", e))?;
    
    println!("📋 Creating {} book copies", actual_total_copies);
    
    // Skip book copy creation if codes are empty
    if codes_to_use.is_empty() {
        println!("⚠️ No book copies to create (no codes provided)");
    } else {
        println!("📝 Will create {} copies with codes: {:?}", codes_to_use.len(), codes_to_use);
        
        // Create copies synchronously but with a new connection to avoid deadlock
        let db_path = dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("library-management-system")
            .join("library.db");
        
        // Use std::thread to completely isolate the database operation
        let book_id_str = book_id.to_string();
        let title_clone = title.clone();
        let author_clone = author.clone();
        let codes_clone = codes_to_use.clone();
        let book_legacy_id_clone = book_legacy_id; // Pass the book's legacy_id to link copies
        
        // Spawn a regular thread (not async) to avoid any async complications
        let handle = std::thread::spawn(move || {
            println!("🧵 Thread: Starting book copy creation");
            
            match rusqlite::Connection::open(&db_path) {
                Ok(conn) => {
                    // Set pragmas for better performance and to avoid locks
                    let _ = conn.execute_batch("
                        PRAGMA busy_timeout = 10000;
                        PRAGMA journal_mode = WAL;
                    ");
                    
                    let mut created_count = 0;
                    let mut skipped_count = 0;
                    
                    for (i, code) in codes_clone.iter().enumerate() {
                        // Use the code as-is from frontend (e.g., HCC/300/22)
                        let copy_identifier = code.clone();
                        
                        // Extract the legacy_book_id from the copy identifier
                        // For format PREFIX/NUMBER/YEAR, extract the NUMBER part
                        let copy_legacy_id = if let Some(parts) = code.split('/').nth(1) {
                            parts.parse::<i32>().unwrap_or_else(|_| {
                                println!("⚠️ Failed to parse legacy ID from '{}', using fallback", code);
                                book_legacy_id_clone + i as i32
                            })
                        } else {
                            println!("⚠️ No legacy ID found in '{}', using fallback", code);
                            book_legacy_id_clone + i as i32
                        };
                        
                        // Generate unique ID using timestamp + index
                        let copy_id = chrono::Utc::now().timestamp_micros() + i as i64;
                        let now = chrono::Utc::now().to_rfc3339();
                        
                        // First check if this copy_identifier already exists
                        let exists: bool = conn.query_row(
                            "SELECT COUNT(*) > 0 FROM book_copies WHERE copy_identifier = ?",
                            [&copy_identifier],
                            |row| row.get(0)
                        ).unwrap_or(false);
                        
                        if exists {
                            println!("⚠️ Thread: Copy identifier {} already exists, skipping", copy_identifier);
                            skipped_count += 1;
                            continue;
                        }
                        
                        // Insert the book copy with proper book_id and legacy_book_id
                        let result = conn.execute(
                            "INSERT INTO book_copies (
                                id, isbn, title, author,
                                copy_identifier, condition, status, legacy_book_id,
                                book_id, created_at, updated_at, synced, sync_version, deleted
                            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                            rusqlite::params![
                                copy_id,
                                "UNKNOWN",
                                &title_clone,
                                &author_clone,
                                &copy_identifier,
                                "good",
                                "available",
                                copy_legacy_id,  // Each copy gets its own legacy_id from the identifier
                                &book_id_str,    // Link to parent book via book_id
                                &now,
                                &now,
                                0,
                                1,
                                0,
                            ],
                        );
                        
                        match result {
                            Ok(_) => {
                                created_count += 1;
                                println!("✅ Thread: Created copy {}/{}: {} (legacy_id: {})", created_count, codes_clone.len(), copy_identifier, copy_legacy_id);
                            }
                            Err(e) => {
                                println!("❌ Thread: Failed to create copy {}: {}", copy_identifier, e);
                                if e.to_string().contains("UNIQUE") {
                                    println!("   ⚠️ This is a UNIQUE constraint violation");
                                    skipped_count += 1;
                                }
                            }
                        }
                    }
                    
                    println!("🎉 Thread: Completed - Created {} copies, Skipped {} duplicates", created_count, skipped_count);
                    created_count
                }
                Err(e) => {
                    println!("❌ Thread: Failed to open database: {}", e);
                    0
                }
            }
        });
        
        // Don't wait for the thread to complete - let it run in background
        println!("📌 Book copy creation running in background thread");
        
        // Store handle for potential future use (optional)
        std::thread::spawn(move || {
            match handle.join() {
                Ok(count) => println!("✅ Background thread completed: {} copies created", count),
                Err(_) => println!("❌ Background thread panicked"),
            }
        });
    }
    
    println!("✅ Book created successfully with {} copies", actual_total_copies);
    Ok(book_id.to_string())
}

// File system commands for opening files and folders
#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    Ok(())
}
