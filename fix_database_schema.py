#!/usr/bin/env python3
"""
Fix the SQLite database schema constraint issue that's preventing book copies sync
"""

import sqlite3
import os
import shutil
from datetime import datetime

def fix_database_schema():
    """Fix the problematic CHECK constraint in the book_copies table"""
    
    # Database paths
    app_dir = os.path.expanduser("~/.local/share/library-management-system")
    db_path = os.path.join(app_dir, "library.db")
    backup_path = os.path.join(app_dir, f"library_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
    
    print("🔧 Fixing database schema constraint issue...")
    print(f"Database path: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return False
    
    try:
        # Create backup
        print("📋 Creating backup...")
        shutil.copy2(db_path, backup_path)
        print(f"✅ Backup created: {backup_path}")
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Checking current book_copies table structure...")
        
        # Get current table schema
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='book_copies'")
        result = cursor.fetchone()
        
        if not result:
            print("❌ book_copies table not found")
            return False
        
        current_schema = result[0]
        print("📊 Current schema:")
        print(current_schema)
        
        # Check if table has data
        cursor.execute("SELECT COUNT(*) FROM book_copies")
        record_count = cursor.fetchone()[0]
        print(f"📚 Current records in book_copies: {record_count}")
        
        print("\n🛠️ Recreating table without problematic CHECK constraint...")
        
        # Start transaction
        cursor.execute("PRAGMA foreign_keys=off")
        cursor.execute("BEGIN TRANSACTION")
        
        # Create new table without the problematic constraint
        new_schema = """
        CREATE TABLE book_copies_new (
            id BIGINT PRIMARY KEY,
            isbn TEXT NOT NULL,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            publisher TEXT,
            publication_year INTEGER CHECK (publication_year BETWEEN 1000 AND 2030),
            copy_identifier TEXT NOT NULL UNIQUE,
            acquisition_date TEXT DEFAULT (date('now')),
            condition TEXT CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
            status TEXT NOT NULL CHECK (status IN ('available', 'checked_out', 'lost', 'repair', 'reserved')),
            location TEXT,
            department_id INTEGER,
            current_borrower_id TEXT,
            borrowed_at TEXT,
            due_date TEXT,
            legacy_book_id INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            synced INTEGER DEFAULT 0,
            sync_version INTEGER DEFAULT 1,
            deleted INTEGER DEFAULT 0
        )
        """
        
        cursor.execute(new_schema)
        print("✅ Created new table with fixed constraints")
        
        # Copy existing data if any
        if record_count > 0:
            print(f"📋 Copying {record_count} existing records...")
            cursor.execute("""
                INSERT INTO book_copies_new 
                SELECT * FROM book_copies
            """)
            print("✅ Data copied successfully")
        
        # Replace the old table
        cursor.execute("DROP TABLE book_copies")
        cursor.execute("ALTER TABLE book_copies_new RENAME TO book_copies")
        print("✅ Table replaced successfully")
        
        # Recreate indexes
        print("🔧 Recreating indexes...")
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_copy_identifier ON book_copies(copy_identifier)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_sync ON book_copies(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_isbn ON book_copies(isbn)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_current_borrower ON book_copies(current_borrower_id)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        print("✅ Indexes recreated")
        
        # Recreate trigger
        print("🔧 Recreating trigger...")
        trigger_sql = """
        CREATE TRIGGER IF NOT EXISTS update_book_copies_timestamp 
            AFTER UPDATE ON book_copies 
            BEGIN 
                UPDATE book_copies SET updated_at = datetime('now') WHERE id = NEW.id;
            END
        """
        cursor.execute(trigger_sql)
        print("✅ Trigger recreated")
        
        # Commit transaction
        cursor.execute("COMMIT")
        cursor.execute("PRAGMA foreign_keys=on")
        
        # Verify the fix
        print("\n🔍 Verifying the fix...")
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='book_copies'")
        new_schema_result = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM book_copies")
        final_count = cursor.fetchone()[0]
        
        print("✅ Schema fix completed successfully!")
        print(f"📊 Final record count: {final_count}")
        print("\n📋 New schema (without problematic strftime constraint):")
        print(new_schema_result)
        
        conn.close()
        
        print(f"\n🎉 Database schema fixed successfully!")
        print(f"📋 Backup saved at: {backup_path}")
        print("\n🚀 You can now run the book copies sync again:")
        print("   cd src-tauri && cargo run --bin debug-book-copies-sync")
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing database schema: {e}")
        
        # Restore backup if something went wrong
        if os.path.exists(backup_path):
            print("🔄 Restoring backup...")
            shutil.copy2(backup_path, db_path)
            print("✅ Backup restored")
        
        return False

if __name__ == "__main__":
    success = fix_database_schema()
    if success:
        print("\n✅ SUCCESS: Database schema fixed!")
        print("The book copies sync should now work without constraint errors.")
    else:
        print("\n❌ FAILED: Could not fix database schema.")
        print("Please check the error messages above.")
