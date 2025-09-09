use anyhow::Result;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;
use chrono::Utc;

/// Clean up invalid borrowing records in the database
pub async fn cleanup_invalid_borrowings() -> Result<()> {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
    
    let db_path = app_dir.join("library.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", db_path.to_str().unwrap())).await?;
    
    println!("🧹 Starting borrowings cleanup...");
    
    // 1. Delete borrowings with non-existent book_ids
    let deleted_books = sqlx::query(
        "DELETE FROM borrowings 
         WHERE book_id NOT IN (SELECT id FROM books)"
    )
    .execute(&pool)
    .await?
    .rows_affected();
    
    println!("🗑️ Deleted {} borrowings with invalid book references", deleted_books);
    
    // 2. Delete borrowings with non-existent student_ids
    let deleted_students = sqlx::query(
        "DELETE FROM borrowings 
         WHERE student_id NOT IN (SELECT id FROM students)"
    )
    .execute(&pool)
    .await?
    .rows_affected();
    
    println!("🗑️ Deleted {} borrowings with invalid student references", deleted_students);
    
    // 3. Fix invalid dates (due_date before borrowed_date or very old dates)
    let current_date = Utc::now().format("%Y-%m-%d").to_string();
    let default_due_date = (Utc::now() + chrono::Duration::days(14)).format("%Y-%m-%d").to_string();
    
    // Fix records where due_date is before borrowed_date
    let fixed_dates1 = sqlx::query(
        "UPDATE borrowings 
         SET borrowed_date = ?, due_date = ?
         WHERE due_date < borrowed_date"
    )
    .bind(&current_date)
    .bind(&default_due_date)
    .execute(&pool)
    .await?
    .rows_affected();
    
    println!("🔧 Fixed {} borrowings where due_date was before borrowed_date", fixed_dates1);
    
    // Fix records with very old dates (before 2020)
    let fixed_dates2 = sqlx::query(
        "UPDATE borrowings 
         SET borrowed_date = ?, due_date = ?
         WHERE borrowed_date < '2020-01-01' OR due_date < '2020-01-01'"
    )
    .bind(&current_date)
    .bind(&default_due_date)
    .execute(&pool)
    .await?
    .rows_affected();
    
    println!("🔧 Fixed {} borrowings with dates before 2020", fixed_dates2);
    
    // 4. Mark all remaining borrowings as unsynced so they get re-uploaded with fixes
    let marked_unsynced = sqlx::query(
        "UPDATE borrowings SET synced = 0 WHERE synced = 1"
    )
    .execute(&pool)
    .await?
    .rows_affected();
    
    println!("🔄 Marked {} borrowings as unsynced for re-upload", marked_unsynced);
    
    println!("✅ Borrowings cleanup completed!");
    println!("📊 Summary:");
    println!("   - Deleted {} invalid book references", deleted_books);
    println!("   - Deleted {} invalid student references", deleted_students);
    println!("   - Fixed {} date order issues", fixed_dates1);
    println!("   - Fixed {} old date issues", fixed_dates2);
    println!("   - Marked {} records for re-sync", marked_unsynced);
    
    Ok(())
}
