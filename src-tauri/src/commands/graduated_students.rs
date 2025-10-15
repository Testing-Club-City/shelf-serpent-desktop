use crate::database::DatabaseManager;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::State;

pub type DatabaseState = Arc<DatabaseManager>;

#[derive(Debug, Serialize, Deserialize)]
pub struct GraduatedStudentQuery {
    pub page: usize,
    pub page_size: usize,
    pub search: Option<String>,
    pub clearance_filter: Option<String>, // "all", "cleared", "not-cleared"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraduatedStudentResponse {
    pub students: Vec<Value>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
}

/// Highly optimized function to fetch graduated students with pagination
/// This is much faster than doing it in JavaScript because:
/// 1. Single database connection
/// 2. Efficient SQL queries with LIMIT/OFFSET
/// 3. No multiple round-trips between JS and Rust
/// 4. Native Rust performance
#[tauri::command]
pub async fn get_graduated_students_paginated(
    query: GraduatedStudentQuery,
    state: State<'_, DatabaseState>,
) -> Result<GraduatedStudentResponse, String> {
    println!("🎓 Fetching graduated students - Page {} (Size: {})", query.page, query.page_size);
    
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    // Build the WHERE clause based on search
    let mut where_clause = String::from("s.deleted = 0 AND s.status = 'graduated'");
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(search) = &query.search {
        if !search.trim().is_empty() {
            where_clause.push_str(" AND (s.first_name LIKE ?1 OR s.last_name LIKE ?1 OR s.admission_number LIKE ?1)");
            params.push(Box::new(format!("%{}%", search)));
        }
    }
    
    // First, get the total count
    let count_query = format!("SELECT COUNT(*) FROM students s WHERE {}", where_clause);
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    
    let total_count: usize = conn.query_row(
        &count_query,
        &param_refs[..],
        |row| row.get(0)
    ).map_err(|e| format!("Count query error: {}", e))?;
    
    println!("📊 Total graduated students: {}", total_count);
    
    // Calculate pagination
    let offset = (query.page.saturating_sub(1)) * query.page_size;
    let total_pages = (total_count + query.page_size - 1) / query.page_size;
    
    // Fetch students for current page with LIMIT and OFFSET
    let students_query = format!(
        "SELECT 
            s.id, s.first_name, s.last_name, s.admission_number, s.class_grade, 
            s.email, s.phone, s.status, s.created_at, s.updated_at
        FROM students s 
        WHERE {}
        ORDER BY s.first_name, s.last_name
        LIMIT {} OFFSET {}",
        where_clause, query.page_size, offset
    );
    
    let mut stmt = conn.prepare(&students_query)
        .map_err(|e| format!("Prepare error: {}", e))?;
    
    let students_iter = stmt.query_map(&param_refs[..], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "first_name": row.get::<_, String>(1)?,
            "last_name": row.get::<_, String>(2)?,
            "admission_number": row.get::<_, Option<String>>(3)?,
            "class_grade": row.get::<_, Option<String>>(4)?,
            "email": row.get::<_, Option<String>>(5)?,
            "phone": row.get::<_, Option<String>>(6)?,
            "status": row.get::<_, String>(7)?,
            "created_at": row.get::<_, String>(8)?,
            "updated_at": row.get::<_, String>(9)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut students = Vec::new();
    for student_result in students_iter {
        let student = student_result.map_err(|e| format!("Row error: {}", e))?;
        students.push(student);
    }
    
    println!("✅ Fetched {} students for page {}", students.len(), query.page);
    
    Ok(GraduatedStudentResponse {
        students,
        total_count,
        page: query.page,
        page_size: query.page_size,
        total_pages,
    })
}

/// Get borrowings and fines summary for graduated students efficiently
/// Returns only counts and totals, not full details
#[tauri::command]
pub async fn get_graduated_student_clearance(
    student_ids: Vec<String>,
    state: State<'_, DatabaseState>,
) -> Result<Vec<Value>, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut results = Vec::new();
    
    for student_id in student_ids {
        // Count active borrowings
        let active_borrowings: i64 = conn.query_row(
            "SELECT COUNT(*) FROM borrowings WHERE student_id = ?1 AND status = 'active' AND deleted = 0",
            [&student_id],
            |row| row.get(0)
        ).unwrap_or(0);
        
        // Count unpaid fines and total amount
        let mut stmt = conn.prepare(
            "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM fines WHERE student_id = ?1 AND status = 'unpaid' AND deleted = 0"
        ).map_err(|e| format!("Prepare error: {}", e))?;
        
        let (unpaid_fines_count, total_fine_amount): (i64, f64) = stmt.query_row(
            [&student_id],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).unwrap_or((0, 0.0));
        
        let is_cleared = active_borrowings == 0 && unpaid_fines_count == 0;
        
        results.push(json!({
            "student_id": student_id,
            "active_borrowings": active_borrowings,
            "unpaid_fines": unpaid_fines_count,
            "total_fine_amount": total_fine_amount,
            "is_cleared": is_cleared
        }));
    }
    
    Ok(results)
}

/// Wrapper command for frontend compatibility
#[tauri::command]
pub async fn get_graduated_students(
    page: usize,
    page_size: usize,
    search_term: Option<String>,
    state: State<'_, DatabaseState>,
) -> Result<GraduatedStudentResponse, String> {
    let query = GraduatedStudentQuery {
        page,
        page_size,
        search: search_term,
        clearance_filter: None,
    };
    get_graduated_students_paginated(query, state).await
}

/// Get clearance data for a single student with detailed borrowing information
#[tauri::command]
pub async fn get_student_clearance_data(
    student_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    // Get active borrowings with book details
    let mut borrowings_stmt = conn.prepare(
        "SELECT 
            b.id,
            b.book_copy_id,
            b.borrowed_date,
            b.due_date,
            b.tracking_code,
            bc.title,
            bc.author,
            bc.copy_identifier,
            bc.tracking_code as book_tracking_code,
            bc.legacy_book_id,
            bk.title as book_title,
            bk.author as book_author,
            bk.legacy_book_id as book_legacy_id
         FROM borrowings b
         LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
         LEFT JOIN books bk ON b.book_id = bk.id
         WHERE b.student_id = ?1 AND b.status = 'active' AND b.deleted = 0
         ORDER BY b.due_date ASC"
    ).map_err(|e| format!("Prepare borrowings error: {}", e))?;
    
    let borrowings_iter = borrowings_stmt.query_map([&student_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "book_copy_id": row.get::<_, Option<String>>(1)?,
            "borrowed_date": row.get::<_, Option<String>>(2)?,
            "due_date": row.get::<_, String>(3)?,
            "tracking_code": row.get::<_, Option<String>>(4)?,
            "book_copy_title": row.get::<_, Option<String>>(5)?,
            "book_copy_author": row.get::<_, Option<String>>(6)?,
            "copy_identifier": row.get::<_, Option<String>>(7)?,
            "book_copy_tracking_code": row.get::<_, Option<String>>(8)?,
            "legacy_book_id": row.get::<_, Option<i64>>(9)?,
            "book_title": row.get::<_, Option<String>>(10)?,
            "book_author": row.get::<_, Option<String>>(11)?,
            "book_legacy_id": row.get::<_, Option<i64>>(12)?,
        }))
    }).map_err(|e| format!("Query borrowings error: {}", e))?;
    
    let mut active_borrowings = Vec::new();
    for borrowing_result in borrowings_iter {
        active_borrowings.push(borrowing_result.map_err(|e| format!("Row error: {}", e))?);
    }
    
    let active_borrowing_count = active_borrowings.len() as i64;
    
    // Get unpaid fines with details
    let mut fines_stmt = conn.prepare(
        "SELECT 
            f.id,
            f.amount,
            f.description,
            f.fine_type,
            f.created_at,
            f.borrowing_id
         FROM fines f
         WHERE f.student_id = ?1 AND f.status = 'unpaid' AND f.deleted = 0
         ORDER BY f.created_at DESC"
    ).map_err(|e| format!("Prepare fines error: {}", e))?;
    
    let fines_iter = fines_stmt.query_map([&student_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "amount": row.get::<_, f64>(1)?,
            "description": row.get::<_, Option<String>>(2)?,
            "fine_type": row.get::<_, String>(3)?,
            "created_at": row.get::<_, String>(4)?,
            "borrowing_id": row.get::<_, Option<String>>(5)?,
        }))
    }).map_err(|e| format!("Query fines error: {}", e))?;
    
    let mut unpaid_fines = Vec::new();
    let mut total_fine_amount = 0.0;
    for fine_result in fines_iter {
        let fine = fine_result.map_err(|e| format!("Row error: {}", e))?;
        if let Some(amount) = fine.get("amount").and_then(|v| v.as_f64()) {
            total_fine_amount += amount;
        }
        unpaid_fines.push(fine);
    }
    
    let unpaid_fine_count = unpaid_fines.len() as i64;
    let has_active_borrowings = active_borrowing_count > 0;
    let has_unpaid_fines = unpaid_fine_count > 0;
    
    Ok(json!({
        "has_active_borrowings": has_active_borrowings,
        "has_unpaid_fines": has_unpaid_fines,
        "active_borrowing_count": active_borrowing_count,
        "unpaid_fine_count": unpaid_fine_count,
        "total_fine_amount": total_fine_amount,
        "active_borrowings": active_borrowings,
        "unpaid_fines": unpaid_fines
    }))
}
