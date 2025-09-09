#!/usr/bin/env python3
"""
Manual migration script to add missing sync columns to existing database
"""

import sqlite3
import os

def fix_sync_columns():
    """Add missing sync columns to all tables"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔧 Fixing missing sync columns...")
        print("=" * 60)
        
        # Tables that need sync columns
        tables_to_fix = [
            "categories", "books", "book_copies", "classes", "students", 
            "staff", "borrowings", "group_borrowings", "fines", "theft_reports"
        ]
        
        required_columns = [
            ("synced", "INTEGER DEFAULT 0"),
            ("sync_version", "INTEGER DEFAULT 1"), 
            ("deleted", "INTEGER DEFAULT 0")
        ]
        
        for table_name in tables_to_fix:
            # Check if table exists
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if cursor.fetchone()[0] == 0:
                print(f"⚠️  {table_name}: Table does not exist, skipping")
                continue
            
            print(f"🔍 Checking {table_name}...")
            
            # Get existing columns
            cursor.execute(f"PRAGMA table_info({table_name})")
            existing_columns = [col[1] for col in cursor.fetchall()]
            
            # Add missing columns
            for col_name, col_definition in required_columns:
                if col_name not in existing_columns:
                    try:
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_definition}"
                        cursor.execute(alter_sql)
                        print(f"  ✅ Added {col_name} to {table_name}")
                    except sqlite3.Error as e:
                        print(f"  ❌ Failed to add {col_name} to {table_name}: {e}")
                else:
                    print(f"  ℹ️  {col_name} already exists in {table_name}")
        
        # Create missing indexes
        print("\n🔧 Creating sync indexes...")
        
        sync_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_books_sync ON books(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_book_copies_sync ON book_copies(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_classes_sync ON classes(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_students_sync ON students(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_staff_sync ON staff(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_borrowings_sync ON borrowings(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_group_borrowings_sync ON group_borrowings(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_fines_sync ON fines(synced, sync_version)",
            "CREATE INDEX IF NOT EXISTS idx_theft_reports_sync ON theft_reports(synced, sync_version)"
        ]
        
        for index_sql in sync_indexes:
            try:
                cursor.execute(index_sql)
                index_name = index_sql.split()[5]  # Extract index name
                print(f"  ✅ Created {index_name}")
            except sqlite3.Error as e:
                print(f"  ❌ Failed to create index: {e}")
        
        # Commit all changes
        conn.commit()
        print("\n✅ All sync column fixes applied successfully!")
        
        # Verify the fixes
        print("\n🔍 Verifying fixes...")
        verify_sync_columns(cursor)
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def verify_sync_columns(cursor):
    """Verify that all tables now have sync columns"""
    
    tables_to_check = [
        "categories", "books", "book_copies", "classes", "students", 
        "staff", "borrowings", "group_borrowings", "fines", "theft_reports"
    ]
    
    required_columns = ["synced", "sync_version", "deleted"]
    all_good = True
    
    for table in tables_to_check:
        try:
            # Check if table exists
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if cursor.fetchone()[0] == 0:
                continue
            
            # Get table columns
            cursor.execute(f"PRAGMA table_info({table})")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]
            
            # Check for required sync columns
            missing_columns = [col for col in required_columns if col not in column_names]
            
            if missing_columns:
                print(f"❌ {table}: Still missing {', '.join(missing_columns)}")
                all_good = False
            else:
                # Count unsynced records
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                total = cursor.fetchone()[0]
                cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0 OR synced IS NULL")
                unsynced = cursor.fetchone()[0]
                print(f"✅ {table}: All columns present ({unsynced}/{total} unsynced)")
                
        except sqlite3.Error as e:
            print(f"❌ {table}: Error - {e}")
            all_good = False
    
    return all_good

def create_test_unsynced_records():
    """Create some test unsynced records for upload testing"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n🧪 Creating test unsynced records...")
        
        # Create a test category
        test_category_id = "test-upload-category-001"
        cursor.execute("""
            INSERT OR REPLACE INTO categories (id, name, description, synced, created_at, updated_at)
            VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))
        """, (test_category_id, "Test Upload Category", "Category for testing upload functionality"))
        
        # Create a test theft report if the table exists
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='theft_reports'")
        if cursor.fetchone()[0] > 0:
            test_theft_id = "test-upload-theft-001"
            cursor.execute("""
                INSERT OR REPLACE INTO theft_reports 
                (id, expected_tracking_code, returned_tracking_code, theft_reason, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))
            """, (test_theft_id, "EXPECTED-001", "RETURNED-002", "Test theft report for upload"))
        
        conn.commit()
        conn.close()
        
        print("✅ Test records created successfully!")
        print("   These records should appear in the upload functionality.")
        
    except Exception as e:
        print(f"❌ Failed to create test records: {e}")

if __name__ == "__main__":
    print("🔧 Manual Sync Columns Migration")
    print("=" * 50)
    
    success = fix_sync_columns()
    
    if success:
        print("\n" + "=" * 50)
        print("🎉 Migration completed successfully!")
        print("   You can now test the upload functionality.")
        
        create_test = input("\nCreate test unsynced records for testing? (y/n): ")
        if create_test.lower() == 'y':
            create_test_unsynced_records()
    else:
        print("\n❌ Migration failed. Please check the errors above.")
