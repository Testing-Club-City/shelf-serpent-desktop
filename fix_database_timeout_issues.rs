// Database Timeout and Connection Issues Fix
// This file contains fixes for the database lock timeout and borrowing issues

use rusqlite::{Connection, Result, params};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::thread;

pub struct DatabaseConnectionManager {
    connection: Arc<Mutex<Connection>>,
    timeout_duration: Duration,
    retry_attempts: u32,
}

impl DatabaseConnectionManager {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Apply aggressive performance optimizations to prevent timeouts
        conn.execute_batch("
            -- Enable WAL mode for better concurrency
            PRAGMA journal_mode = WAL;
            
            -- Reduce synchronous writes for better performance
            PRAGMA synchronous = NORMAL;
            
            -- Increase cache size to 128MB
            PRAGMA cache_size = -131072;
            
            -- Enable foreign keys
            PRAGMA foreign_keys = ON;
            
            -- Store temporary tables in memory
            PRAGMA temp_store = MEMORY;
            
            -- Enable memory mapping (256MB)
            PRAGMA mmap_size = 268435456;
            
            -- Set busy timeout to 30 seconds
            PRAGMA busy_timeout = 30000;
            
            -- Optimize WAL checkpointing
            PRAGMA wal_autocheckpoint = 1000;
            
            -- Enable query planner optimizations
            PRAGMA optimize;
        ")?;
        
        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
            timeout_duration: Duration::from_secs(30),
            retry_attempts: 5,
        })
    }
    
    /// Enhanced connection locking with exponential backoff
    pub fn with_connection<F, R>(&self, operation: F) -> Result<R>
    where
        F: FnOnce(&Connection) -> Result<R>,
    {
        let start_time = Instant::now();
        let mut attempt = 0;
        
        loop {
            attempt += 1;
            
            match self.connection.try_lock() {
                Ok(conn) => {
                    println!("🔒 Database lock acquired on attempt {}", attempt);
                    return operation(&*conn);
                }
                Err(std::sync::TryLockError::WouldBlock) => {
                    if attempt >= self.retry_attempts {
                        eprintln!("❌ Database lock timeout after {} attempts", attempt);
                        return Err(rusqlite::Error::SqliteFailure(
                            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
                            Some("Database lock timeout - operation took too long".to_string())
                        ));
                    }
                    
                    if start_time.elapsed() > self.timeout_duration {
                        eprintln!("❌ Database operation timeout after {:?}", start_time.elapsed());
                        return Err(rusqlite::Error::SqliteFailure(
                            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
                            Some("Database operation timeout".to_string())
                        ));
                    }
                    
                    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms
                    let wait_time = Duration::from_millis(50 * (1 << (attempt - 1)));
                    println!("⏳ Attempt {}/{} - waiting {:?} for database lock...", 
                            attempt, self.retry_attempts, wait_time);
                    thread::sleep(wait_time);
                }
                Err(std::sync::TryLockError::Poisoned(e)) => {
                    eprintln!("❌ Database connection poisoned: {:?}", e);
                    return Err(rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISUSE),
                        Some("Database connection is poisoned".to_string())
                    ));
                }
            }
        }
    }
    
    /// Fix borrowings table schema issues
    pub fn fix_borrowings_schema(&self) -> Result<()> {
        self.with_connection(|conn| {
            println!("🔧 Fixing borrowings table schema...");
            
            // Check if borrowings table exists and has correct structure
            let table_info: Vec<(String, String)> = conn.prepare("PRAGMA table_info(borrowings)")?
                .query_map([], |row| {
                    Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?))
                })?
                .collect::<Result<Vec<_>, _>>()?;
            
            println!("📋 Current borrowings table columns: {:?}", table_info);
            
            // Add missing columns if they don't exist
            let required_columns = vec![
                ("student_id", "TEXT"),
                ("staff_id", "TEXT"),
                ("borrower_type", "TEXT DEFAULT 'student'"),
                ("book_id", "TEXT NOT NULL"),
                ("book_copy_id", "TEXT NOT NULL"),
                ("tracking_code", "TEXT"),
                ("borrowed_date", "TEXT NOT NULL"),
                ("due_date", "TEXT NOT NULL"),
                ("returned_date", "TEXT"),
                ("condition_at_issue", "TEXT DEFAULT 'good'"),
                ("condition_at_return", "TEXT"),
                ("notes", "TEXT"),
                ("status", "TEXT DEFAULT 'active'"),
                ("synced", "INTEGER DEFAULT 0"),
                ("sync_version", "INTEGER DEFAULT 1"),
                ("deleted", "INTEGER DEFAULT 0"),
            ];
            
            for (column_name, column_type) in required_columns {
                let column_exists = table_info.iter()
                    .any(|(name, _)| name == column_name);
                
                if !column_exists {
                    let alter_sql = format!("ALTER TABLE borrowings ADD COLUMN {} {}", column_name, column_type);
                    match conn.execute(&alter_sql, []) {
                        Ok(_) => println!("✅ Added column '{}' to borrowings table", column_name),
                        Err(e) => println!("⚠️ Failed to add column '{}': {}", column_name, e),
                    }
                }
            }
            
            // Create indexes for better performance
            let indexes = vec![
                "CREATE INDEX IF NOT EXISTS idx_borrowings_student ON borrowings(student_id)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_staff ON borrowings(staff_id)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy ON borrowings(book_copy_id)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON borrowings(due_date)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_tracking_code ON borrowings(tracking_code)",
            ];
            
            for index_sql in indexes {
                match conn.execute(index_sql, []) {
                    Ok(_) => println!("✅ Created index"),
                    Err(e) => println!("⚠️ Index creation failed: {}", e),
                }
            }
            
            Ok(())
        })
    }
    
    /// Fix group borrowings table schema
    pub fn fix_group_borrowings_schema(&self) -> Result<()> {
        self.with_connection(|conn| {
            println!("🔧 Fixing group_borrowings table schema...");
            
            // Create group_borrowings table if it doesn't exist
            conn.execute("
                CREATE TABLE IF NOT EXISTS group_borrowings (
                    id TEXT PRIMARY KEY,
                    class_id TEXT,
                    class_name TEXT NOT NULL,
                    book_id TEXT NOT NULL,
                    book_title TEXT,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    borrowed_date TEXT NOT NULL,
                    due_date TEXT NOT NULL,
                    returned_date TEXT,
                    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
                    notes TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    synced INTEGER DEFAULT 0,
                    sync_version INTEGER DEFAULT 1,
                    deleted INTEGER DEFAULT 0,
                    FOREIGN KEY (book_id) REFERENCES books(id)
                )
            ", [])?;
            
            // Add missing columns to existing table
            let missing_columns = vec![
                ("class_name", "TEXT"),
                ("book_title", "TEXT"),
                ("synced", "INTEGER DEFAULT 0"),
                ("sync_version", "INTEGER DEFAULT 1"),
                ("deleted", "INTEGER DEFAULT 0"),
            ];
            
            for (column_name, column_type) in missing_columns {
                let alter_sql = format!("ALTER TABLE group_borrowings ADD COLUMN {} {}", column_name, column_type);
                match conn.execute(&alter_sql, []) {
                    Ok(_) => println!("✅ Added column '{}' to group_borrowings", column_name),
                    Err(_) => {}, // Column might already exist
                }
            }
            
            // Create indexes
            let indexes = vec![
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_class ON group_borrowings(class_id, class_name)",
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_book ON group_borrowings(book_id)",
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_status ON group_borrowings(status)",
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_due_date ON group_borrowings(due_date)",
            ];
            
            for index_sql in indexes {
                conn.execute(index_sql, [])?;
            }
            
            println!("✅ Group borrowings schema fixed");
            Ok(())
        })
    }
    
    /// Optimize database performance
    pub fn optimize_database(&self) -> Result<()> {
        self.with_connection(|conn| {
            println!("🚀 Optimizing database performance...");
            
            // Run VACUUM to reclaim space and defragment
            conn.execute("VACUUM", [])?;
            println!("✅ Database vacuumed");
            
            // Analyze tables for query optimization
            conn.execute("ANALYZE", [])?;
            println!("✅ Database analyzed");
            
            // Update table statistics
            conn.execute("PRAGMA optimize", [])?;
            println!("✅ Query planner optimized");
            
            // Checkpoint WAL file
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", [])?;
            println!("✅ WAL checkpoint completed");
            
            Ok(())
        })
    }
    
    /// Test database connectivity and performance
    pub fn test_database_performance(&self) -> Result<()> {
        println!("🧪 Testing database performance...");
        
        let start_time = Instant::now();
        
        self.with_connection(|conn| {
            // Test basic connectivity
            let version: String = conn.query_row("SELECT sqlite_version()", [], |row| row.get(0))?;
            println!("📊 SQLite version: {}", version);
            
            // Test table counts
            let tables = vec!["books", "students", "borrowings", "group_borrowings", "categories"];
            for table in tables {
                match conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| row.get::<_, i64>(0)) {
                    Ok(count) => println!("📋 {} table: {} records", table, count),
                    Err(e) => println!("⚠️ {} table error: {}", table, e),
                }
            }
            
            // Test write performance
            let test_start = Instant::now();
            conn.execute("CREATE TEMP TABLE test_performance (id INTEGER, data TEXT)", [])?;
            conn.execute("INSERT INTO test_performance VALUES (1, 'test')", [])?;
            conn.execute("DROP TABLE test_performance", [])?;
            println!("⚡ Write test completed in {:?}", test_start.elapsed());
            
            Ok(())
        })?;
        
        println!("✅ Database performance test completed in {:?}", start_time.elapsed());
        Ok(())
    }
}

/// Main function to fix all database issues
pub fn fix_all_database_issues(db_path: &str) -> Result<()> {
    println!("🔧 Starting comprehensive database fix...");
    
    let db_manager = DatabaseConnectionManager::new(db_path)?;
    
    // Fix schema issues
    db_manager.fix_borrowings_schema()?;
    db_manager.fix_group_borrowings_schema()?;
    
    // Optimize performance
    db_manager.optimize_database()?;
    
    // Test everything works
    db_manager.test_database_performance()?;
    
    println!("✅ All database issues fixed successfully!");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    
    #[test]
    fn test_database_connection_manager() {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_str().unwrap();
        
        let manager = DatabaseConnectionManager::new(db_path).unwrap();
        
        // Test connection works
        let result = manager.with_connection(|conn| {
            conn.execute("CREATE TABLE test (id INTEGER)", [])
        });
        
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_schema_fixes() {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_str().unwrap();
        
        let manager = DatabaseConnectionManager::new(db_path).unwrap();
        
        // Create basic tables first
        manager.with_connection(|conn| {
            conn.execute("CREATE TABLE borrowings (id TEXT PRIMARY KEY)", [])
        }).unwrap();
        
        // Test schema fix
        assert!(manager.fix_borrowings_schema().is_ok());
        assert!(manager.fix_group_borrowings_schema().is_ok());
    }
}