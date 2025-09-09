use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn get_books_fast(
    db: State<'_, crate::commands::DatabaseState>,
) -> Result<Vec<Value>, String> {
    println!("🚀 Fast books fetch requested");
    
    match db.get_books_optimized().await {
        Ok(books) => {
            println!("✅ Fast books fetch completed: {} books", books.len());
            Ok(books)
        }
        Err(e) => {
            eprintln!("❌ Fast books fetch failed: {}", e);
            Err(format!("Failed to fetch books: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_books_paginated_books(
    db: State<'_, crate::commands::DatabaseState>,
    page: i32,
    page_size: i32,
) -> Result<serde_json::Value, String> {
    println!("📄 Paginated books fetch: page {}, size {}", page, page_size);
    
    match db.get_books_paginated(page, page_size).await {
        Ok((books, total_count)) => {
            println!("✅ Paginated fetch completed: {} books, {} total", books.len(), total_count);
            Ok(serde_json::json!({
                "data": books,
                "total": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) / page_size
            }))
        }
        Err(e) => {
            eprintln!("❌ Paginated books fetch failed: {}", e);
            Err(format!("Failed to fetch paginated books: {}", e))
        }
    }
}

#[tauri::command]
pub async fn search_books_fast(
    db: State<'_, crate::commands::DatabaseState>,
    query: String,
) -> Result<Vec<Value>, String> {
    println!("🔍 Fast book search: '{}'", query);
    
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    
    match db.search_books_fast(&query).await {
        Ok(books) => {
            println!("✅ Fast search completed: {} results", books.len());
            Ok(books)
        }
        Err(e) => {
            eprintln!("❌ Fast search failed: {}", e);
            Err(format!("Failed to search books: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_dashboard_stats(
    db: State<'_, crate::commands::DatabaseState>,
) -> Result<HashMap<String, i32>, String> {
    println!("📊 Dashboard stats requested");
    
    match db.get_dashboard_stats_fast().await {
        Ok(stats) => {
            println!("✅ Dashboard stats completed");
            Ok(stats)
        }
        Err(e) => {
            eprintln!("❌ Dashboard stats failed: {}", e);
            Err(format!("Failed to get dashboard stats: {}", e))
        }
    }
}

#[tauri::command]
pub async fn initialize_performance_indexes(
    db: State<'_, crate::commands::DatabaseState>,
) -> Result<String, String> {
    println!("🔧 Creating performance indexes");
    
    match db.create_performance_indexes().await {
        Ok(_) => {
            println!("✅ Performance indexes created");
            Ok("Performance indexes created successfully".to_string())
        }
        Err(e) => {
            eprintln!("❌ Failed to create indexes: {}", e);
            Err(format!("Failed to create performance indexes: {}", e))
        }
    }
}

#[tauri::command]
pub async fn find_borrowing_by_legacy_id(
    db: State<'_, crate::commands::DatabaseState>,
    legacy_id: String,
) -> Result<Option<Value>, String> {
    println!("🔍 Finding borrowing by legacy ID: {}", legacy_id);
    
    match db.find_borrowing_by_legacy_id(&legacy_id).await {
        Ok(borrowing) => {
            if borrowing.is_some() {
                println!("✅ Found borrowing for legacy ID {}", legacy_id);
            } else {
                println!("ℹ️ No active borrowing found for legacy ID {}", legacy_id);
            }
            Ok(borrowing)
        }
        Err(e) => {
            eprintln!("❌ Legacy ID borrowing search failed: {}", e);
            Err(format!("Failed to find borrowing by legacy ID: {}", e))
        }
    }
}

#[tauri::command]
pub async fn search_book_copy_by_legacy_id(
    db: State<'_, crate::commands::DatabaseState>,
    legacy_book_id: i32,
) -> Result<Option<Value>, String> {
    println!("🔍 Searching book copy by legacy ID: {}", legacy_book_id);
    
    match db.search_book_copy_by_legacy_id(legacy_book_id).await {
        Ok(book_copy) => {
            if book_copy.is_some() {
                println!("✅ Found book copy for legacy ID {}", legacy_book_id);
            } else {
                println!("ℹ️ No available book copy found for legacy ID {}", legacy_book_id);
            }
            Ok(book_copy)
        }
        Err(e) => {
            eprintln!("❌ Legacy ID book copy search failed: {}", e);
            Err(format!("Failed to find book copy by legacy ID: {}", e))
        }
    }
}

