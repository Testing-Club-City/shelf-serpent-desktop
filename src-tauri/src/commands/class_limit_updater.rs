use crate::database::DatabaseManager;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

pub type DatabaseState = Arc<DatabaseManager>;

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateResult {
    pub updated_classes: i32,
    pub message: String,
}

/// Update all classes with their corresponding form/grade level limits
/// This ensures all sections of the same form (e.g., Form 2A, 2B, 2C) have the same limit
#[tauri::command]
pub async fn update_class_limits_by_form_level(
    form_limits: HashMap<i32, i32>,
    grade_limits: HashMap<i32, i32>,
    state: State<'_, DatabaseState>,
) -> Result<UpdateResult, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut updated_count = 0;
    
    // Update Form-based classes (Secondary School)
    for (form_level, max_books) in form_limits.iter() {
        let result = conn.execute(
            "UPDATE classes 
             SET max_books_allowed = ?1, updated_at = datetime('now')
             WHERE form_level = ?2 
             AND (academic_level_type = 'form' OR academic_level_type IS NULL)
             AND deleted = 0",
            [max_books, form_level]
        );
        
        match result {
            Ok(count) => {
                updated_count += count as i32;
                println!("Updated {} classes for Form {}", count, form_level);
            }
            Err(e) => {
                eprintln!("Error updating Form {}: {}", form_level, e);
            }
        }
    }
    
    // Update Grade-based classes (Primary/CBC)
    for (grade_level, max_books) in grade_limits.iter() {
        let result = conn.execute(
            "UPDATE classes 
             SET max_books_allowed = ?1, updated_at = datetime('now')
             WHERE form_level = ?2 
             AND academic_level_type = 'grade'
             AND deleted = 0",
            [max_books, grade_level]
        );
        
        match result {
            Ok(count) => {
                updated_count += count as i32;
                println!("Updated {} classes for Grade {}", count, grade_level);
            }
            Err(e) => {
                eprintln!("Error updating Grade {}: {}", grade_level, e);
            }
        }
    }
    
    Ok(UpdateResult {
        updated_classes: updated_count,
        message: format!("Successfully updated {} classes with new borrowing limits", updated_count),
    })
}

/// Get all classes grouped by their form/grade level for display
#[tauri::command]
pub async fn get_classes_by_level(
    state: State<'_, DatabaseState>,
) -> Result<Vec<ClassLevelSummary>, String> {
    let conn = state.get_connection().lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT 
            form_level,
            academic_level_type,
            COUNT(*) as class_count,
            MAX(max_books_allowed) as max_books,
            GROUP_CONCAT(class_name, ', ') as class_names
         FROM classes
         WHERE deleted = 0 AND is_active = 1
         GROUP BY form_level, academic_level_type
         ORDER BY academic_level_type, form_level"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let results = stmt.query_map([], |row| {
        Ok(ClassLevelSummary {
            form_level: row.get(0)?,
            academic_level_type: row.get(1)?,
            class_count: row.get(2)?,
            max_books_allowed: row.get(3)?,
            class_names: row.get(4)?,
        })
    }).map_err(|e| format!("Failed to query classes: {}", e))?;
    
    let mut summaries = Vec::new();
    for result in results {
        match result {
            Ok(summary) => summaries.push(summary),
            Err(e) => eprintln!("Error reading class summary: {}", e),
        }
    }
    
    Ok(summaries)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClassLevelSummary {
    pub form_level: i32,
    pub academic_level_type: String,
    pub class_count: i32,
    pub max_books_allowed: i32,
    pub class_names: String,
}
