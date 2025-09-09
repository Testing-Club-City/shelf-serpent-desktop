#!/usr/bin/env python3
"""
Database Timeout and Connection Issues Fix Script
This script fixes the database lock timeout and borrowing issues shown in the error logs.
"""

import sqlite3
import os
import time
import sys
from pathlib import Path

class DatabaseFixer:
    def __init__(self, db_path="library.db"):
        self.db_path = db_path
        self.backup_path = f"{db_path}.backup_{int(time.time())}"
        
    def create_backup(self):
        """Create a backup of the database before making changes"""
        if os.path.exists(self.db_path):
            print(f"📋 Creating backup: {self.backup_path}")
            import shutil
            shutil.copy2(self.db_path, self.backup_path)
            print("✅ Backup created successfully")
        
    def get_connection(self, timeout=30):
        """Get database connection with optimized settings"""
        conn = sqlite3.connect(
            self.db_path,
            timeout=timeout,
            isolation_level=None  # Autocommit mode
        )
        
        # Apply performance optimizations
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL") 
        conn.execute("PRAGMA cache_size = -64000")  # 64MB cache
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA temp_store = MEMORY")
        conn.execute("PRAGMA mmap_size = 268435456")  # 256MB mmap
        conn.execute("PRAGMA busy_timeout = 30000")  # 30 second timeout
        
        return conn
    
    def fix_borrowings_table(self):
        """Fix the borrowings table schema and add missing columns"""
        print("🔧 Fixing borrowings table...")
        
        with self.get_connection() as conn:
            # Check current table structure
            cursor = conn.execute("PRAGMA table_info(borrowings)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            print(f"📋 Current borrowings columns: {list(columns.keys())}")
            
            # Add missing columns
            missing_columns = {
                'student_id': 'TEXT',
                'staff_id': 'TEXT', 
                'borrower_type': 'TEXT DEFAULT "student"',
                'book_id': 'TEXT',
                'book_copy_id': 'TEXT',
                'tracking_code': 'TEXT',
                'borrowed_date': 'TEXT',
                'due_date': 'TEXT',
                'returned_date': 'TEXT',
                'condition_at_issue': 'TEXT DEFAULT "good"',
                'condition_at_return': 'TEXT',
                'notes': 'TEXT',
                'status': 'TEXT DEFAULT "active"',
                'synced': 'INTEGER DEFAULT 0',
                'sync_version': 'INTEGER DEFAULT 1',
                'deleted': 'INTEGER DEFAULT 0'
            }
            
            for column_name, column_type in missing_columns.items():
                if column_name not in columns:
                    try:
                        conn.execute(f"ALTER TABLE borrowings ADD COLUMN {column_name} {column_type}")
                        print(f"✅ Added column: {column_name}")
                    except sqlite3.Error as e:
                        print(f"⚠️ Could not add column {column_name}: {e}")
            
            # Create indexes for better performance
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_borrowings_student ON borrowings(student_id)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_staff ON borrowings(staff_id)", 
                "CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy ON borrowings(book_copy_id)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON borrowings(due_date)",
                "CREATE INDEX IF NOT EXISTS idx_borrowings_tracking_code ON borrowings(tracking_code)"
            ]
            
            for index_sql in indexes:
                try:
                    conn.execute(index_sql)
                    print("✅ Created index")
                except sqlite3.Error as e:
                    print(f"⚠️ Index creation failed: {e}")
    
    def fix_group_borrowings_table(self):
        """Fix the group_borrowings table schema"""
        print("🔧 Fixing group_borrowings table...")
        
        with self.get_connection() as conn:
            # Create table if it doesn't exist
            conn.execute("""
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
                    deleted INTEGER DEFAULT 0
                )
            """)
            
            # Check and add missing columns
            cursor = conn.execute("PRAGMA table_info(group_borrowings)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            
            missing_columns = {
                'class_name': 'TEXT',
                'book_title': 'TEXT',
                'synced': 'INTEGER DEFAULT 0',
                'sync_version': 'INTEGER DEFAULT 1', 
                'deleted': 'INTEGER DEFAULT 0'
            }
            
            for column_name, column_type in missing_columns.items():
                if column_name not in columns:
                    try:
                        conn.execute(f"ALTER TABLE group_borrowings ADD COLUMN {column_name} {column_type}")
                        print(f"✅ Added column: {column_name}")
                    except sqlite3.Error as e:
                        print(f"⚠️ Could not add column {column_name}: {e}")
            
            # Create indexes
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_class ON group_borrowings(class_id, class_name)",
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_book ON group_borrowings(book_id)",
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_status ON group_borrowings(status)",
                "CREATE INDEX IF NOT EXISTS idx_group_borrowings_due_date ON group_borrowings(due_date)"
            ]
            
            for index_sql in indexes:
                try:
                    conn.execute(index_sql)
                    print("✅ Created group borrowings index")
                except sqlite3.Error as e:
                    print(f"⚠️ Group borrowings index creation failed: {e}")
    
    def optimize_database(self):
        """Optimize database performance"""
        print("🚀 Optimizing database performance...")
        
        with self.get_connection() as conn:
            try:
                # Vacuum to reclaim space
                print("🧹 Running VACUUM...")
                conn.execute("VACUUM")
                print("✅ VACUUM completed")
                
                # Analyze for query optimization
                print("📊 Running ANALYZE...")
                conn.execute("ANALYZE")
                print("✅ ANALYZE completed")
                
                # Optimize query planner
                conn.execute("PRAGMA optimize")
                print("✅ Query planner optimized")
                
                # Checkpoint WAL
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                print("✅ WAL checkpoint completed")
                
            except sqlite3.Error as e:
                print(f"⚠️ Optimization warning: {e}")
    
    def test_database_connectivity(self):
        """Test database connectivity and performance"""
        print("🧪 Testing database connectivity...")
        
        start_time = time.time()
        
        try:
            with self.get_connection() as conn:
                # Test basic connectivity
                version = conn.execute("SELECT sqlite_version()").fetchone()[0]
                print(f"📊 SQLite version: {version}")
                
                # Test table counts
                tables = ['books', 'students', 'borrowings', 'group_borrowings', 'categories']
                for table in tables:
                    try:
                        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                        print(f"📋 {table}: {count} records")
                    except sqlite3.Error as e:
                        print(f"⚠️ {table} table error: {e}")
                
                # Test write performance
                test_start = time.time()
                conn.execute("CREATE TEMP TABLE test_performance (id INTEGER, data TEXT)")
                conn.execute("INSERT INTO test_performance VALUES (1, 'test')")
                conn.execute("DROP TABLE test_performance")
                write_time = time.time() - test_start
                print(f"⚡ Write test: {write_time:.3f}s")
                
        except sqlite3.Error as e:
            print(f"❌ Database connectivity test failed: {e}")
            return False
        
        total_time = time.time() - start_time
        print(f"✅ Database connectivity test completed in {total_time:.3f}s")
        return True
    
    def fix_all_issues(self):
        """Run all fixes"""
        print("🔧 Starting comprehensive database fix...")
        print(f"📁 Database path: {os.path.abspath(self.db_path)}")
        
        # Create backup
        self.create_backup()
        
        try:
            # Fix schema issues
            self.fix_borrowings_table()
            self.fix_group_borrowings_table()
            
            # Optimize performance  
            self.optimize_database()
            
            # Test connectivity
            if self.test_database_connectivity():
                print("✅ All database issues fixed successfully!")
                return True
            else:
                print("❌ Database issues remain after fix attempt")
                return False
                
        except Exception as e:
            print(f"❌ Error during database fix: {e}")
            print(f"💾 Backup available at: {self.backup_path}")
            return False

def main():
    """Main function"""
    # Look for database in common locations
    possible_paths = [
        "library.db",
        "shelf-serpent.db", 
        os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "library-management-system", "library.db"),
        os.path.join(os.path.expanduser("~"), ".local", "share", "library-management-system", "library.db")
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Could not find database file. Please specify the path:")
        print("Usage: python fix_database_timeout.py [database_path]")
        if len(sys.argv) > 1:
            db_path = sys.argv[1]
        else:
            return
    
    print(f"🎯 Using database: {db_path}")
    
    fixer = DatabaseFixer(db_path)
    success = fixer.fix_all_issues()
    
    if success:
        print("\n🎉 Database fix completed successfully!")
        print("💡 The application should now work without timeout errors.")
    else:
        print("\n❌ Database fix encountered issues.")
        print("💡 Check the backup file and try running the fix again.")

if __name__ == "__main__":
    main()