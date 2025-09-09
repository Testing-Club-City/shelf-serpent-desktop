use serde::{Deserialize, Serialize};
use tauri::{command, State};
use rusqlite::params;

#[derive(Serialize, Deserialize, Debug)]
pub struct Student {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub admission_number: String,
    pub class_grade: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Book {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub isbn: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BookCopy {
    pub id: i64,
    pub book_id: i64,
    pub tracking_code: String,
    pub copy_number: i64,
    pub status: String,
    pub condition: String,
    pub book: Book,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GroupBorrowing {
    pub id: i64,
    pub student_admissions: Vec<String>,
    pub book_copy_id: i64,
    pub borrowed_date: String,
    pub return_date: String,
    pub purpose: String,
    pub notes: String,
    pub status: String,
    pub student_count: i64,
}

// Commands moved to mod.rs to avoid duplicates

#[command]
pub async fn get_group_borrowings_by_admission(admission_number: String, state: State<'_, crate::commands::DatabaseState>) -> Result<Vec<GroupBorrowing>, String> {
    let conn = state.get_connection();
    let conn = conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, student_admissions, book_copy_id, borrowed_date, return_date, purpose, notes, status, student_count FROM group_borrowings WHERE student_admissions LIKE ?")
        .map_err(|e| e.to_string())?;
    
    let borrowings = stmt
        .query_map(params![format!("%{}%", admission_number)], |row| {
            let student_admissions_str: String = row.get(1)?;
            let student_admissions: Vec<String> = serde_json::from_str(&student_admissions_str)
                .unwrap_or_default();
            
            Ok(GroupBorrowing {
                id: row.get(0)?,
                student_admissions,
                book_copy_id: row.get(2)?,
                borrowed_date: row.get(3)?,
                return_date: row.get(4)?,
                purpose: row.get(5)?,
                notes: row.get(6)?,
                status: row.get(7)?,
                student_count: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(borrowings)
}
