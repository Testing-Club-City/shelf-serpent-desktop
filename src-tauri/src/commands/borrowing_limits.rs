use crate::database::DatabaseManager;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::State;

pub type DatabaseState = Arc<DatabaseManager>;

#[derive(Debug, Serialize, Deserialize)]
pub struct BorrowingLimitCheck {
    pub can_borrow: bool,
    pub current_borrowed: i64,
    pub max_allowed: i64,
    pub remaining_slots: i64,
    pub class_name: Option<String>,
    pub message: String,
}

/// Check if a student can borrow more books based on their class limit
#[tauri::command]
pub async fn check_student_borrowing_limit(
    student_id: String,
    state: State<'_, DatabaseState>,
) -> Result<BorrowingLimitCheck, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    // Get student's class information including form level
    // NOTE: Students are linked to classes via class_grade field (NOT class_id which is NULL)
    let class_info: Result<(Option<String>, Option<i64>, Option<i64>), rusqlite::Error> = conn.query_row(
        "SELECT c.class_name, c.max_books_allowed, c.form_level
         FROM students s
         LEFT JOIN classes c ON s.class_grade = c.class_name AND c.deleted = 0
         WHERE s.id = ?1 AND s.deleted = 0",
        [&student_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, Option<i64>>(2)?
            ))
        }
    );
    
    let (class_name, max_books_allowed, form_level) = match class_info {
        Ok((name, limit, level)) => {
            println!("📚 Student class info - Name: {:?}, Limit: {:?}, Form: {:?}", name, limit, level);
            
            // Provide more context in the class name if form level is available
            let display_name = if let (Some(ref n), Some(l)) = (&name, level) {
                Some(format!("{} (Form {})", n, l))
            } else {
                name
            };
            
            // Log warning if limit is NULL
            if limit.is_none() {
                println!("⚠️  WARNING: max_books_allowed is NULL for student {}, using default of 2", student_id);
            }
            
            (display_name, limit.unwrap_or(2), level)
        },
        Err(e) => {
            println!("❌ Error fetching student class info: {}", e);
            return Ok(BorrowingLimitCheck {
                can_borrow: false,
                current_borrowed: 0,
                max_allowed: 0,
                remaining_slots: 0,
                class_name: None,
                message: "Student not found or not assigned to a class".to_string(),
            });
        }
    };
    
    // Count current active borrowings for the student (excluding group borrowings)
    let current_borrowed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrowings 
         WHERE student_id = ?1 
         AND status = 'active' 
         AND deleted = 0
         AND (group_borrowing_id IS NULL OR group_borrowing_id = '')",
        [&student_id],
        |row| row.get(0)
    ).unwrap_or(0);
    
    let remaining_slots = max_books_allowed - current_borrowed;
    let can_borrow = remaining_slots > 0;
    
    let message = if can_borrow {
        format!(
            "Student can borrow {} more book(s). ({}/{}  books currently borrowed)",
            remaining_slots, current_borrowed, max_books_allowed
        )
    } else {
        format!(
            "Student has reached the borrowing limit of {} book(s) for their class",
            max_books_allowed
        )
    };
    
    Ok(BorrowingLimitCheck {
        can_borrow,
        current_borrowed,
        max_allowed: max_books_allowed,
        remaining_slots,
        class_name,
        message,
    })
}

/// Check if a staff member can borrow more books (staff usually have higher limits)
#[tauri::command]
pub async fn check_staff_borrowing_limit(
    staff_id: String,
    state: State<'_, DatabaseState>,
) -> Result<BorrowingLimitCheck, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    // Staff typically have a higher limit (e.g., 5-10 books)
    let max_books_allowed: i64 = 5; // This could be configurable or stored in staff table
    
    // Count current active borrowings for the staff member (excluding group borrowings)
    let current_borrowed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrowings 
         WHERE staff_id = ?1 
         AND borrower_type = 'staff'
         AND status = 'active' 
         AND deleted = 0
         AND (group_borrowing_id IS NULL OR group_borrowing_id = '')",
        [&staff_id],
        |row| row.get(0)
    ).unwrap_or(0);
    
    let remaining_slots = max_books_allowed - current_borrowed;
    let can_borrow = remaining_slots > 0;
    
    let message = if can_borrow {
        format!(
            "Staff can borrow {} more book(s). ({}/{} books currently borrowed)",
            remaining_slots, current_borrowed, max_books_allowed
        )
    } else {
        format!(
            "Staff has reached the borrowing limit of {} books",
            max_books_allowed
        )
    };
    
    Ok(BorrowingLimitCheck {
        can_borrow,
        current_borrowed,
        max_allowed: max_books_allowed,
        remaining_slots,
        class_name: None,
        message,
    })
}

/// Get class borrowing limit for a specific class
#[tauri::command]
pub async fn get_class_borrowing_limit(
    class_id: String,
    state: State<'_, DatabaseState>,
) -> Result<Value, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    let result: Result<(String, i64), rusqlite::Error> = conn.query_row(
        "SELECT class_name, max_books_allowed 
         FROM classes 
         WHERE id = ?1 AND deleted = 0",
        [&class_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?
            ))
        }
    );
    
    match result {
        Ok((class_name, max_books_allowed)) => {
            Ok(json!({
                "class_name": class_name,
                "max_books_allowed": max_books_allowed
            }))
        }
        Err(_) => Err("Class not found".to_string())
    }
}
