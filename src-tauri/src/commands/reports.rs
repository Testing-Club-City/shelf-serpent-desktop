use crate::database::DatabaseManager;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::State;

pub type DatabaseState = Arc<DatabaseManager>;

#[tauri::command]
pub async fn get_books_by_supplier(
    supplier_type: Option<String>,
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // First check if supplier columns exist
    let has_supplier_cols: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('books') WHERE name IN ('supplier_type', 'supplier_name')",
        [],
        |row| row.get::<_, i32>(0).map(|count| count >= 2)
    ).unwrap_or(false);
    
    if !has_supplier_cols {
        return Ok(json!({
            "success": true,
            "data": [],
            "total": 0,
            "message": "Supplier columns not available in database"
        }));
    }
    
    let query = if supplier_type.is_some() {
        "SELECT supplier_type, supplier_name, COUNT(*) as count, 
                GROUP_CONCAT(title, ', ') as book_titles
         FROM books 
         WHERE supplier_type = ? AND (deleted = 0 OR deleted IS NULL)
         GROUP BY supplier_type, supplier_name"
    } else {
        "SELECT supplier_type, supplier_name, COUNT(*) as count,
                GROUP_CONCAT(title, ', ') as book_titles
         FROM books 
         WHERE (deleted = 0 OR deleted IS NULL) AND supplier_type IS NOT NULL
         GROUP BY supplier_type, supplier_name"
    };
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let mut results = Vec::new();
    
    if let Some(supplier) = supplier_type {
        let rows = stmt.query_map([supplier], |row| {
            Ok(json!({
                "supplier_type": row.get::<_, Option<String>>(0)?,
                "supplier_name": row.get::<_, Option<String>>(1)?,
                "count": row.get::<_, i32>(2)?,
                "book_titles": row.get::<_, Option<String>>(3)?
            }))
        }).map_err(|e| format!("Query execution error: {}", e))?;
        
        for row in rows {
            results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
        }
    } else {
        let rows = stmt.query_map([], |row| {
            Ok(json!({
                "supplier_type": row.get::<_, Option<String>>(0)?,
                "supplier_name": row.get::<_, Option<String>>(1)?,
                "count": row.get::<_, i32>(2)?,
                "book_titles": row.get::<_, Option<String>>(3)?
            }))
        }).map_err(|e| format!("Query execution error: {}", e))?;
        
        for row in rows {
            results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
        }
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_staff_overdue_books(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "SELECT 
        b.id as borrowing_id,
        b.borrowed_date,
        b.due_date,
        b.status,
        st.first_name,
        st.last_name,
        st.staff_id,
        st.department,
        bc.title as book_title,
        bc.author as book_author,
        bc.copy_identifier,
        bc.legacy_book_id,
        julianday('now') - julianday(b.due_date) as days_overdue
    FROM borrowings b
    INNER JOIN staff st ON b.staff_id = st.id AND (st.deleted = 0 OR st.deleted IS NULL)
    INNER JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
    WHERE b.status = 'active' 
      AND b.staff_id IS NOT NULL
      AND b.due_date < date('now')
      AND (b.deleted = 0 OR b.deleted IS NULL)
    ORDER BY days_overdue DESC";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "borrowing_id": row.get::<_, String>(0)?,
            "borrowed_date": row.get::<_, String>(1)?,
            "due_date": row.get::<_, String>(2)?,
            "status": row.get::<_, String>(3)?,
            "staff": {
                "first_name": row.get::<_, Option<String>>(4)?,
                "last_name": row.get::<_, Option<String>>(5)?,
                "staff_id": row.get::<_, Option<String>>(6)?,
                "department": row.get::<_, Option<String>>(7)?
            },
            "book": {
                "title": row.get::<_, Option<String>>(8)?.unwrap_or("Unknown Book".to_string()),
                "author": row.get::<_, Option<String>>(9)?.unwrap_or("Unknown Author".to_string()),
                "copy_identifier": row.get::<_, Option<String>>(10)?,
                "legacy_book_id": row.get::<_, Option<i64>>(11)?
            },
            "days_overdue": row.get::<_, f64>(12)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_student_overdue_books(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "SELECT 
        b.id as borrowing_id,
        b.borrowed_date,
        b.due_date,
        b.status,
        s.first_name,
        s.last_name,
        s.admission_number,
        s.class_grade,
        bc.title as book_title,
        bc.author as book_author,
        bc.copy_identifier,
        bc.legacy_book_id,
        julianday('now') - julianday(b.due_date) as days_overdue
    FROM borrowings b
    INNER JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
    INNER JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
    WHERE b.status = 'active' 
      AND b.student_id IS NOT NULL
      AND b.due_date < date('now')
      AND (b.deleted = 0 OR b.deleted IS NULL)
    ORDER BY days_overdue DESC";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        let legacy_id = row.get::<_, Option<i64>>(11)?;
        Ok(json!({
            "borrowing_id": row.get::<_, String>(0)?,
            "borrowed_date": row.get::<_, String>(1)?,
            "due_date": row.get::<_, String>(2)?,
            "status": row.get::<_, String>(3)?,
            "student": {
                "first_name": row.get::<_, Option<String>>(4)?,
                "last_name": row.get::<_, Option<String>>(5)?,
                "admission_number": row.get::<_, Option<String>>(6)?,
                "class_grade": row.get::<_, Option<String>>(7)?
            },
            "book": {
                "title": row.get::<_, Option<String>>(8)?.unwrap_or("Unknown Book".to_string()),
                "author": row.get::<_, Option<String>>(9)?.unwrap_or("Unknown Author".to_string()),
                "copy_identifier": row.get::<_, Option<String>>(10)?,
                "legacy_book_id": legacy_id
            },
            "days_overdue": row.get::<_, f64>(12)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_books_by_category(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "SELECT 
        CASE 
            WHEN c.name IS NOT NULL AND c.name != '' THEN c.name
            WHEN b.category_id IS NOT NULL THEN 'Category ID: ' || b.category_id
            ELSE 'Uncategorized'
        END as category_name,
        COUNT(b.id) as book_count,
        GROUP_CONCAT(b.title, ', ') as book_titles
    FROM books b
    LEFT JOIN categories c ON b.category_id = c.id AND (c.deleted = 0 OR c.deleted IS NULL)
    WHERE (b.deleted = 0 OR b.deleted IS NULL)
    GROUP BY COALESCE(c.name, 'Uncategorized')
    ORDER BY book_count DESC";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "category_name": row.get::<_, String>(0)?,
            "book_count": row.get::<_, i32>(1)?,
            "book_titles": row.get::<_, Option<String>>(2)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_borrowing_statistics(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let stats = conn.query_row(
        "SELECT 
            (SELECT COUNT(*) FROM borrowings WHERE status = 'active' AND (deleted = 0 OR deleted IS NULL)) as active_borrowings,
            (SELECT COUNT(*) FROM borrowings WHERE status = 'returned' AND (deleted = 0 OR deleted IS NULL)) as returned_borrowings,
            (SELECT COUNT(*) FROM borrowings WHERE status = 'active' AND due_date < date('now') AND (deleted = 0 OR deleted IS NULL)) as overdue_borrowings,
            (SELECT COUNT(*) FROM borrowings WHERE (borrower_type = 'student' OR student_id IS NOT NULL) AND (deleted = 0 OR deleted IS NULL)) as student_borrowings,
            (SELECT COUNT(*) FROM borrowings WHERE (borrower_type = 'staff' OR staff_id IS NOT NULL) AND (deleted = 0 OR deleted IS NULL)) as staff_borrowings,
            (SELECT AVG(julianday(returned_date) - julianday(borrowed_date)) FROM borrowings WHERE returned_date IS NOT NULL AND (deleted = 0 OR deleted IS NULL)) as avg_borrowing_duration",
        [],
        |row| {
            Ok(json!({
                "active_borrowings": row.get::<_, i32>(0)?,
                "returned_borrowings": row.get::<_, i32>(1)?,
                "overdue_borrowings": row.get::<_, i32>(2)?,
                "student_borrowings": row.get::<_, i32>(3)?,
                "staff_borrowings": row.get::<_, i32>(4)?,
                "avg_borrowing_duration_days": row.get::<_, Option<f64>>(5)?
            }))
        }
    ).map_err(|e| format!("Query execution error: {}", e))?;
    
    Ok(json!({
        "success": true,
        "data": stats
    }))
}

#[tauri::command]
pub async fn get_popular_books(
    limit: Option<i32>,
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let limit = limit.unwrap_or(10);
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "SELECT 
        b.title,
        b.author,
        b.isbn,
        CASE 
            WHEN c.name IS NOT NULL AND c.name != '' THEN c.name
            WHEN b.category_id IS NOT NULL THEN 'Category ID: ' || b.category_id
            ELSE 'Uncategorized'
        END as category,
        COUNT(br.id) as borrow_count,
        MAX(br.borrowed_date) as last_borrowed
    FROM books b
    LEFT JOIN categories c ON b.category_id = c.id AND (c.deleted = 0 OR c.deleted IS NULL)
    LEFT JOIN borrowings br ON b.id = br.book_id AND (br.deleted = 0 OR br.deleted IS NULL)
    WHERE (b.deleted = 0 OR b.deleted IS NULL)
    GROUP BY b.id, b.title, b.author, b.isbn, c.name, b.category_id
    HAVING borrow_count > 0
    ORDER BY borrow_count DESC, last_borrowed DESC
    LIMIT ?";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([limit], |row| {
        Ok(json!({
            "title": row.get::<_, String>(0)?,
            "author": row.get::<_, String>(1)?,
            "isbn": row.get::<_, Option<String>>(2)?,
            "category": row.get::<_, String>(3)?,
            "borrow_count": row.get::<_, i32>(4)?,
            "last_borrowed": row.get::<_, Option<String>>(5)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_class_borrowing_report(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "SELECT 
        s.class_grade,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(b.id) as total_borrowings,
        COUNT(CASE WHEN b.status = 'active' THEN 1 END) as active_borrowings,
        COUNT(CASE WHEN b.status = 'active' AND b.due_date < date('now') THEN 1 END) as overdue_borrowings
    FROM students s
    LEFT JOIN borrowings b ON s.id = b.student_id AND (b.deleted = 0 OR b.deleted IS NULL)
    WHERE (s.deleted = 0 OR s.deleted IS NULL) AND (s.status = 'active' OR s.status IS NULL)
    GROUP BY s.class_grade
    HAVING s.class_grade IS NOT NULL AND s.class_grade != ''
    ORDER BY s.class_grade";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "class_grade": row.get::<_, String>(0)?,
            "total_students": row.get::<_, i32>(1)?,
            "total_borrowings": row.get::<_, i32>(2)?,
            "active_borrowings": row.get::<_, i32>(3)?,
            "overdue_borrowings": row.get::<_, i32>(4)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_fine_reports(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Check if fines table exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='fines'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).unwrap_or(false);
    
    if !table_exists {
        return Ok(json!({
            "success": true,
            "data": [],
            "total": 0,
            "message": "Fines table not available"
        }));
    }
    
    let query = "SELECT 
        f.id,
        f.fine_type,
        f.amount,
        f.status,
        f.description,
        f.created_at,
        CASE 
            WHEN f.student_id IS NOT NULL THEN 'student'
            WHEN f.staff_id IS NOT NULL THEN 'staff'
            ELSE 'unknown'
        END as borrower_type,
        COALESCE(s.first_name || ' ' || s.last_name, st.first_name || ' ' || st.last_name) as borrower_name,
        COALESCE(s.admission_number, st.staff_id) as borrower_id,
        COALESCE(b.title, bc.title) as book_title,
        bc.copy_identifier
    FROM fines f
    LEFT JOIN students s ON f.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
    LEFT JOIN staff st ON f.staff_id = st.id AND (st.deleted = 0 OR st.deleted IS NULL)
    LEFT JOIN borrowings br ON f.borrowing_id = br.id AND (br.deleted = 0 OR br.deleted IS NULL)
    LEFT JOIN books b ON br.book_id = b.id AND (b.deleted = 0 OR b.deleted IS NULL)
    LEFT JOIN book_copies bc ON br.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
    WHERE (f.deleted = 0 OR f.deleted IS NULL)
    ORDER BY f.created_at DESC";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "fine_type": row.get::<_, String>(1)?,
            "amount": row.get::<_, f64>(2)?,
            "status": row.get::<_, String>(3)?,
            "description": row.get::<_, Option<String>>(4)?,
            "created_at": row.get::<_, String>(5)?,
            "borrower_type": row.get::<_, String>(6)?,
            "borrower_name": row.get::<_, Option<String>>(7)?,
            "borrower_id": row.get::<_, Option<String>>(8)?,
            "book_title": row.get::<_, Option<String>>(9)?,
            "copy_identifier": row.get::<_, Option<String>>(10)?
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_lost_books(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "SELECT 
        bc.id,
        bc.tracking_code,
        bc.copy_number,
        bc.status,
        bc.condition,
        bc.notes,
        bc.updated_at as lost_date,
        b.id as book_id,
        b.title,
        b.author,
        b.isbn,
        b.book_code,
        br.id as borrowing_id,
        br.fine_amount,
        br.borrowed_date,
        br.due_date,
        br.is_lost,
        s.id as student_id,
        s.first_name,
        s.last_name,
        s.admission_number,
        s.class_grade
    FROM book_copies bc
    INNER JOIN books b ON bc.book_id = b.id AND (b.deleted = 0 OR b.deleted IS NULL)
    LEFT JOIN borrowings br ON bc.id = br.book_copy_id AND br.is_lost = 1 AND (br.deleted = 0 OR br.deleted IS NULL)
    LEFT JOIN students s ON br.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
    WHERE (bc.status = 'lost' OR br.is_lost = 1) 
      AND (bc.deleted = 0 OR bc.deleted IS NULL)
    ORDER BY bc.updated_at DESC";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "tracking_code": row.get::<_, Option<String>>(1)?,
            "copy_number": row.get::<_, Option<i32>>(2)?,
            "status": row.get::<_, String>(3)?,
            "condition": row.get::<_, String>(4)?,
            "notes": row.get::<_, Option<String>>(5)?,
            "lost_date": row.get::<_, String>(6)?,
            "borrowing_id": row.get::<_, Option<String>>(12)?,
            "fine_amount": row.get::<_, Option<f64>>(13)?,
            "borrowed_date": row.get::<_, Option<String>>(14)?,
            "due_date": row.get::<_, Option<String>>(15)?,
            "is_lost": row.get::<_, Option<bool>>(16)?,
            "books": {
                "id": row.get::<_, String>(7)?,
                "title": row.get::<_, String>(8)?,
                "author": row.get::<_, Option<String>>(9)?,
                "isbn": row.get::<_, Option<String>>(10)?,
                "book_code": row.get::<_, Option<String>>(11)?
            },
            "students": if row.get::<_, Option<String>>(17)?.is_some() {
                Some(json!({
                    "id": row.get::<_, Option<String>>(17)?,
                    "first_name": row.get::<_, Option<String>>(18)?,
                    "last_name": row.get::<_, Option<String>>(19)?,
                    "admission_number": row.get::<_, Option<String>>(20)?,
                    "class_grade": row.get::<_, Option<String>>(21)?
                }))
            } else {
                None
            },
            "type": if row.get::<_, Option<String>>(12)?.is_some() { "lost_borrowing" } else { "lost_copy" }
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}

#[tauri::command]
pub async fn get_theft_reports(
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Check if theft_reports table exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='theft_reports'",
        [],
        |row| row.get::<_, i32>(0).map(|count| count > 0)
    ).unwrap_or(false);
    
    if !table_exists {
        return Ok(json!({
            "success": true,
            "data": [],
            "total": 0,
            "message": "Theft reports table not available"
        }));
    }
    
    let query = "SELECT 
        tr.id,
        tr.student_id,
        tr.book_id,
        tr.book_copy_id,
        tr.borrowing_id,
        tr.expected_tracking_code,
        tr.returned_tracking_code,
        tr.theft_reason,
        tr.reported_date,
        tr.reported_by,
        tr.status,
        tr.investigation_notes,
        tr.resolved_date,
        tr.resolved_by,
        tr.created_at,
        tr.updated_at,
        -- Victim (student whose book was stolen)
        s.id as victim_id,
        s.first_name as victim_first_name,
        s.last_name as victim_last_name,
        s.admission_number as victim_admission_number,
        s.class_grade as victim_class_grade,
        -- Book details
        b.id as book_id,
        b.title as book_title,
        b.author as book_author,
        b.book_code,
        -- Book copy details
        bc.id as copy_id,
        bc.copy_number,
        bc.tracking_code,
        -- Borrowing details (perpetrator info)
        br.id as borrowing_id,
        br.issued_by,
        br.borrowed_date,
        -- Perpetrator (student who stole the book)
        s2.id as perpetrator_id,
        s2.first_name as perpetrator_first_name,
        s2.last_name as perpetrator_last_name,
        s2.admission_number as perpetrator_admission_number,
        s2.class_grade as perpetrator_class_grade
    FROM theft_reports tr
    LEFT JOIN students s ON tr.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
    LEFT JOIN books b ON tr.book_id = b.id AND (b.deleted = 0 OR b.deleted IS NULL)
    LEFT JOIN book_copies bc ON tr.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
    LEFT JOIN borrowings br ON tr.borrowing_id = br.id AND (br.deleted = 0 OR br.deleted IS NULL)
    LEFT JOIN students s2 ON br.student_id = s2.id AND (s2.deleted = 0 OR s2.deleted IS NULL)
    WHERE (tr.deleted = 0 OR tr.deleted IS NULL)
    ORDER BY tr.created_at DESC";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
    
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "student_id": row.get::<_, Option<String>>(1)?,
            "book_id": row.get::<_, Option<String>>(2)?,
            "book_copy_id": row.get::<_, Option<String>>(3)?,
            "borrowing_id": row.get::<_, Option<String>>(4)?,
            "expected_tracking_code": row.get::<_, String>(5)?,
            "returned_tracking_code": row.get::<_, String>(6)?,
            "theft_reason": row.get::<_, Option<String>>(7)?,
            "reported_date": row.get::<_, String>(8)?,
            "reported_by": row.get::<_, Option<String>>(9)?,
            "status": row.get::<_, String>(10)?,
            "investigation_notes": row.get::<_, Option<String>>(11)?,
            "resolved_date": row.get::<_, Option<String>>(12)?,
            "resolved_by": row.get::<_, Option<String>>(13)?,
            "created_at": row.get::<_, String>(14)?,
            "updated_at": row.get::<_, Option<String>>(15)?,
            "students": if row.get::<_, Option<String>>(16)?.is_some() {
                Some(json!({
                    "id": row.get::<_, Option<String>>(16)?,
                    "first_name": row.get::<_, Option<String>>(17)?,
                    "last_name": row.get::<_, Option<String>>(18)?,
                    "admission_number": row.get::<_, Option<String>>(19)?,
                    "class_grade": row.get::<_, Option<String>>(20)?
                }))
            } else {
                None
            },
            "books": {
                "id": row.get::<_, Option<String>>(21)?,
                "title": row.get::<_, Option<String>>(22)?,
                "author": row.get::<_, Option<String>>(23)?,
                "book_code": row.get::<_, Option<String>>(24)?
            },
            "book_copies": if row.get::<_, Option<String>>(25)?.is_some() {
                Some(json!({
                    "id": row.get::<_, Option<String>>(25)?,
                    "copy_number": row.get::<_, Option<i32>>(26)?,
                    "tracking_code": row.get::<_, Option<String>>(27)?
                }))
            } else {
                None
            },
            "borrowings": if row.get::<_, Option<String>>(28)?.is_some() {
                Some(json!({
                    "id": row.get::<_, Option<String>>(28)?,
                    "issued_by": row.get::<_, Option<String>>(29)?,
                    "borrowed_date": row.get::<_, Option<String>>(30)?,
                    "students": if row.get::<_, Option<String>>(31)?.is_some() {
                        Some(json!({
                            "id": row.get::<_, Option<String>>(31)?,
                            "first_name": row.get::<_, Option<String>>(32)?,
                            "last_name": row.get::<_, Option<String>>(33)?,
                            "admission_number": row.get::<_, Option<String>>(34)?,
                            "class_grade": row.get::<_, Option<String>>(35)?
                        }))
                    } else {
                        None
                    }
                }))
            } else {
                None
            }
        }))
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(json!({
        "success": true,
        "data": results,
        "total": results.len()
    }))
}