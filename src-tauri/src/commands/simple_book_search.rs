use tauri::State;
use serde_json::Value;

#[tauri::command]
pub async fn simple_search_book_by_legacy_id(
    legacy_book_id: i32,
    db: State<'_, crate::commands::DatabaseState>,
) -> Result<Option<Value>, String> {
    println!("🔍 Simple search for legacy_book_id: {}", legacy_book_id);
    
    let conn = db.get_connection().lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let query = "
        SELECT 
            bc.id, bc.title, bc.author, bc.status, bc.copy_identifier, bc.legacy_book_id
        FROM book_copies bc
        WHERE bc.legacy_book_id = ? 
          AND bc.status = 'available'
          AND (bc.deleted = 0 OR bc.deleted IS NULL)
          AND bc.id NOT IN (
              SELECT book_copy_id FROM borrowings 
              WHERE status = 'active' AND book_copy_id IS NOT NULL
          )
        LIMIT 1
    ";
    
    match conn.query_row(query, [legacy_book_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "title": row.get::<_, String>(1)?,
            "author": row.get::<_, String>(2)?,
            "status": row.get::<_, String>(3)?,
            "copy_identifier": row.get::<_, String>(4)?,
            "legacy_book_id": row.get::<_, Option<i64>>(5)?,
            "books": {
                "title": row.get::<_, String>(1)?,
                "author": row.get::<_, String>(2)?
            }
        }))
    }) {
        Ok(book) => {
            println!("✅ Found book: {}", book["title"]);
            Ok(Some(book))
        },
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            println!("❌ No book found with legacy_book_id: {}", legacy_book_id);
            Ok(None)
        },
        Err(e) => {
            println!("❌ Database error: {}", e);
            Err(format!("Database error: {}", e))
        }
    }
}