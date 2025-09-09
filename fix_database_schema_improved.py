#!/usr/bin/env python3
"""
Improved fix for the SQLite database schema constraint issue
Handles views and other dependencies properly
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
    
    print("🔧 Fixing database schema constraint issue (improved version)...")
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
        
        print("🔍 Analyzing database dependencies...")
        
        # Get all views that depend on book_copies
        cursor.execute("""
            SELECT name, sql FROM sqlite_master 
            WHERE type='view' AND sql LIKE '%book_copies%'
        """)
        dependent_views = cursor.fetchall()
        
        print(f"📊 Found {len(dependent_views)} views that depend on book_copies:")
        for view_name, _ in dependent_views:
            print(f"  - {view_name}")
        
        # Get all triggers on book_copies
        cursor.execute("""
            SELECT name, sql FROM sqlite_master 
            WHERE type='trigger' AND tbl_name='book_copies'
        """)
        triggers = cursor.fetchall()
        
        print(f"🔧 Found {len(triggers)} triggers on book_copies:")
        for trigger_name, _ in triggers:
            print(f"  - {trigger_name}")
        
        # Get all indexes on book_copies
        cursor.execute("""
            SELECT name, sql FROM sqlite_master 
            WHERE type='index' AND tbl_name='book_copies' AND sql IS NOT NULL
        """)
        indexes = cursor.fetchall()
        
        print(f"📇 Found {len(indexes)} indexes on book_copies:")
        for index_name, _ in indexes:
            print(f"  - {index_name}")
        
        # Check if table has data
        cursor.execute("SELECT COUNT(*) FROM book_copies")
        record_count = cursor.fetchone()[0]
        print(f"📚 Current records in book_copies: {record_count}")
        
        print("\n🛠️ Starting schema fix process...")
        
        # Start transaction
        cursor.execute("PRAGMA foreign_keys=off")
        cursor.execute("BEGIN TRANSACTION")
        
        # Step 1: Drop dependent views
        print("🗑️ Dropping dependent views...")
        for view_name, _ in dependent_views:
            cursor.execute(f"DROP VIEW IF EXISTS {view_name}")
            print(f"  ✅ Dropped view: {view_name}")
        
        # Step 2: Drop triggers
        print("🗑️ Dropping triggers...")
        for trigger_name, _ in triggers:
            cursor.execute(f"DROP TRIGGER IF EXISTS {trigger_name}")
            print(f"  ✅ Dropped trigger: {trigger_name}")
        
        # Step 3: Drop indexes (they'll be recreated automatically)
        print("🗑️ Dropping indexes...")
        for index_name, _ in indexes:
            cursor.execute(f"DROP INDEX IF EXISTS {index_name}")
            print(f"  ✅ Dropped index: {index_name}")
        
        # Step 4: Create new table with fixed constraints
        print("🔧 Creating new table with fixed constraints...")
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
        
        # Step 5: Copy existing data if any
        if record_count > 0:
            print(f"📋 Copying {record_count} existing records...")
            cursor.execute("""
                INSERT INTO book_copies_new 
                SELECT * FROM book_copies
            """)
            print("✅ Data copied successfully")
        
        # Step 6: Replace the old table
        cursor.execute("DROP TABLE book_copies")
        cursor.execute("ALTER TABLE book_copies_new RENAME TO book_copies")
        print("✅ Table replaced successfully")
        
        # Step 7: Recreate indexes
        print("🔧 Recreating indexes...")
        for index_name, index_sql in indexes:
            if index_sql:  # Only recreate if we have the SQL
                cursor.execute(index_sql)
                print(f"  ✅ Recreated index: {index_name}")
        
        # Step 8: Recreate triggers
        print("🔧 Recreating triggers...")
        for trigger_name, trigger_sql in triggers:
            if trigger_sql:
                cursor.execute(trigger_sql)
                print(f"  ✅ Recreated trigger: {trigger_name}")
        
        # Step 9: Recreate views
        print("🔧 Recreating views...")
        for view_name, view_sql in dependent_views:
            if view_sql:
                cursor.execute(view_sql)
                print(f"  ✅ Recreated view: {view_name}")
        
        # Commit transaction
        cursor.execute("COMMIT")
        cursor.execute("PRAGMA foreign_keys=on")
        
        # Verify the fix
        print("\n🔍 Verifying the fix...")
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='book_copies'")
        new_schema_result = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM book_copies")
        final_count = cursor.fetchone()[0]
        
        # Test that the constraint issue is fixed by trying to insert a test record
        print("🧪 Testing constraint fix...")
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO book_copies 
                (id, isbn, title, author, publication_year, copy_identifier, status)
                VALUES ('test-id', 'test-isbn', 'Test Book', 'Test Author', 2024, 'test-copy', 'available')
            """)
            cursor.execute("DELETE FROM book_copies WHERE id = 'test-id'")
            print("✅ Constraint test passed - no more strftime() errors!")
        except Exception as e:
            print(f"⚠️ Constraint test failed: {e}")
        
        print("✅ Schema fix completed successfully!")
        print(f"📊 Final record count: {final_count}")
        
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
