use std::path::PathBuf;
use std::time::Duration;
use rusqlite::{Connection, Result};

/// Immediate fix for database locking issues
fn main() -> Result<()> {
    println!("🔧 Emergency database lock fix starting...");
    
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("library-management-system");
        
    let db_path = app_dir.join("library.db");
    
    if !db_path.exists() {
        println!("❌ Database file not found at: {:?}", db_path);
        return Ok(());
    }
    
    println!("📂 Found database at: {:?}", db_path);
    
    // Open connection with optimized settings
    let conn = Connection::open(&db_path)?;
    
    // Set aggressive timeout
    conn.busy_timeout(Duration::from_secs(1))?;
    
    println!("🔄 Applying emergency fixes...");
    
    // 1. Switch to WAL mode for better concurrency
    match conn.execute("PRAGMA journal_mode = WAL", []) {
        Ok(_) => println!("✅ Switched to WAL mode"),
        Err(e) => println!("⚠️ WAL mode warning: {}", e),
    }
    
    // 2. Checkpoint any pending WAL data
    match conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []) {
        Ok(_) => println!("✅ WAL checkpoint completed"),
        Err(e) => println!("⚠️ Checkpoint warning: {}", e),
    }
    
    // 3. Optimize database settings
    let optimizations = [
        ("PRAGMA synchronous = NORMAL", "Synchronous mode"),
        ("PRAGMA cache_size = -32000", "Cache size (32MB)"),
        ("PRAGMA temp_store = memory", "Temp store in memory"),
        ("PRAGMA busy_timeout = 10000", "Busy timeout (10s)"),
        ("PRAGMA wal_autocheckpoint = 100", "WAL autocheckpoint"),
    ];
    
    for (pragma, description) in &optimizations {
        match conn.execute(pragma, []) {
            Ok(_) => println!("✅ Applied: {}", description),
            Err(e) => println!("⚠️ Failed {}: {}", description, e),
        }
    }
    
    // 4. Check for and fix any corrupted indexes
    println!("🔍 Checking database integrity...");
    match conn.prepare("PRAGMA integrity_check") {
        Ok(mut stmt) => {
            let integrity_results: Vec<String> = stmt.query_map([], |row| {
                Ok(row.get::<_, String>(0)?)
            })?.collect::<Result<Vec<_>, _>>()?;
            
            if integrity_results.len() == 1 && integrity_results[0] == "ok" {
                println!("✅ Database integrity OK");
            } else {
                println!("⚠️ Database integrity issues found: {:?}", integrity_results);
            }
        }
        Err(e) => println!("⚠️ Could not check integrity: {}", e),
    }
    
    // 5. Optimize book_copies table specifically
    println!("📚 Optimizing book_copies table...");
    
    // Create missing indexes
    let indexes = [
        ("CREATE INDEX IF NOT EXISTS idx_book_copies_id_opt ON book_copies(id)", "ID index"),
        ("CREATE INDEX IF NOT EXISTS idx_book_copies_legacy_opt ON book_copies(legacy_book_id) WHERE legacy_book_id IS NOT NULL", "Legacy ID index"),
        ("CREATE INDEX IF NOT EXISTS idx_book_copies_sync_opt ON book_copies(synced, sync_version)", "Sync index"),
    ];
    
    for (sql, description) in &indexes {
        match conn.execute(sql, []) {
            Ok(_) => println!("✅ Created: {}", description),
            Err(e) => println!("⚠️ Index warning {}: {}", description, e),
        }
    }
    
    // 5b. Optimize borrowings table
    println!("📖 Optimizing borrowings table...");
    
    let borrowings_indexes = [
        ("CREATE INDEX IF NOT EXISTS idx_borrowings_id_opt ON borrowings(id)", "Borrowings ID index"),
        ("CREATE INDEX IF NOT EXISTS idx_borrowings_student_opt ON borrowings(student_id)", "Student index"),
        ("CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy_opt ON borrowings(book_copy_id)", "Book copy index"),
        ("CREATE INDEX IF NOT EXISTS idx_borrowings_status_opt ON borrowings(status, deleted)", "Status index"),
        ("CREATE INDEX IF NOT EXISTS idx_borrowings_sync_opt ON borrowings(synced, sync_version)", "Borrowings sync index"),
    ];
    
    for (sql, description) in &indexes {
        match conn.execute(sql, []) {
            Ok(_) => println!("✅ Created: {}", description),
            Err(e) => println!("⚠️ Index warning {}: {}", description, e),
        }
    }
    
    for (sql, description) in &borrowings_indexes {
        match conn.execute(sql, []) {
            Ok(_) => println!("✅ Created: {}", description),
            Err(e) => println!("⚠️ Index warning {}: {}", description, e),
        }
    }
    
    // 6. Analyze tables for better query planning
    match conn.execute("ANALYZE book_copies", []) {
        Ok(_) => println!("✅ Analyzed book_copies table"),
        Err(e) => println!("⚠️ Analysis warning: {}", e),
    }
    
    match conn.execute("ANALYZE borrowings", []) {
        Ok(_) => println!("✅ Analyzed borrowings table"),
        Err(e) => println!("⚠️ Analysis warning: {}", e),
    }
    
    // 7. Final checkpoint
    match conn.execute("PRAGMA wal_checkpoint(PASSIVE)", []) {
        Ok(_) => println!("✅ Final checkpoint completed"),
        Err(e) => println!("⚠️ Final checkpoint warning: {}", e),
    }
    
    // 8. Check current database stats
    println!("📊 Database statistics:");
    
    if let Ok(mut stmt) = conn.prepare("SELECT COUNT(*) FROM book_copies") {
        if let Ok(count) = stmt.query_row([], |row| row.get::<_, i64>(0)) {
            println!("   📚 Book copies: {}", count);
        }
    }
    
    if let Ok(mut stmt) = conn.prepare("SELECT COUNT(*) FROM borrowings") {
        if let Ok(count) = stmt.query_row([], |row| row.get::<_, i64>(0)) {
            println!("   📖 Borrowings: {}", count);
        }
    }
    
    if let Ok(mut stmt) = conn.prepare("PRAGMA page_count") {
        if let Ok(pages) = stmt.query_row([], |row| row.get::<_, i64>(0)) {
            if let Ok(mut stmt2) = conn.prepare("PRAGMA page_size") {
                if let Ok(page_size) = stmt2.query_row([], |row| row.get::<_, i64>(0)) {
                    let size_mb = (pages * page_size) / 1024 / 1024;
                    println!("   💾 Database size: {} MB", size_mb);
                }
            }
        }
    }
    
    if let Ok(mut stmt) = conn.prepare("PRAGMA journal_mode") {
        if let Ok(mode) = stmt.query_row([], |row| row.get::<_, String>(0)) {
            println!("   📄 Journal mode: {}", mode);
        }
    }
    
    println!("🎉 Emergency database lock fix completed!");
    println!("💡 Recommendations:");
    println!("   - Restart your application to pick up the new settings");
    println!("   - Use smaller batch sizes for future sync operations");
    println!("   - Monitor WAL file size and checkpoint regularly");
    
    Ok(())
}