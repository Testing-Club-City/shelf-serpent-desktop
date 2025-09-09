#!/usr/bin/env python3
"""
Test script to verify that all tables have the necessary sync columns
"""

import sqlite3
import os

def test_sync_columns():
    """Check if all tables have the required sync columns"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        print("   Please run the application first to create the database.")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Checking sync columns in all tables...")
        print("=" * 70)
        
        # Tables that should have sync columns
        tables_with_sync = [
            "categories", "books", "book_copies", "classes", "students", 
            "staff", "borrowings", "group_borrowings", "fines", "theft_reports"
        ]
        
        required_columns = ["synced", "sync_version", "deleted"]
        
        all_good = True
        
        for table in tables_with_sync:
            try:
                # Check if table exists
                cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (table,))
                table_exists = cursor.fetchone()[0] > 0
                
                if not table_exists:
                    print(f"⚠️  {table:<20}: Table does not exist")
                    continue
                
                # Get table info
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                column_names = [col[1] for col in columns]
                
                # Check for required sync columns
                missing_columns = []
                for req_col in required_columns:
                    if req_col not in column_names:
                        missing_columns.append(req_col)
                
                if missing_columns:
                    print(f"❌ {table:<20}: Missing columns: {', '.join(missing_columns)}")
                    all_good = False
                else:
                    # Count records and unsynced records
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    total_count = cursor.fetchone()[0]
                    
                    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0 OR synced IS NULL")
                    unsynced_count = cursor.fetchone()[0]
                    
                    print(f"✅ {table:<20}: All sync columns present ({unsynced_count}/{total_count} unsynced)")
                    
            except sqlite3.Error as e:
                print(f"❌ {table:<20}: Database error - {e}")
                all_good = False
        
        print("=" * 70)
        
        if all_good:
            print("🎉 All tables have the required sync columns!")
            print("   The upload functionality should work correctly.")
        else:
            print("⚠️  Some tables are missing sync columns.")
            print("   Please restart the application to run the migration.")
        
        # Check indexes
        print("\n🔍 Checking sync indexes...")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%_sync'")
        sync_indexes = [row[0] for row in cursor.fetchall()]
        
        expected_indexes = [
            "idx_categories_sync", "idx_books_sync", "idx_book_copies_sync",
            "idx_classes_sync", "idx_students_sync", "idx_staff_sync",
            "idx_borrowings_sync", "idx_group_borrowings_sync", 
            "idx_fines_sync", "idx_theft_reports_sync"
        ]
        
        missing_indexes = [idx for idx in expected_indexes if idx not in sync_indexes]
        
        if missing_indexes:
            print(f"⚠️  Missing sync indexes: {', '.join(missing_indexes)}")
        else:
            print("✅ All sync indexes are present")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

def show_table_schemas():
    """Show the schema for tables with sync columns"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n📋 Table schemas for sync-enabled tables:")
        print("=" * 70)
        
        tables = ["group_borrowings", "theft_reports"]
        
        for table in tables:
            try:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                
                print(f"\n🔧 {table.upper()} table structure:")
                for col in columns:
                    col_name = col[1]
                    col_type = col[2]
                    is_nullable = "NOT NULL" if col[3] else "NULL"
                    default_val = f"DEFAULT {col[4]}" if col[4] else ""
                    
                    marker = "🔄" if col_name in ["synced", "sync_version", "deleted"] else "  "
                    print(f"  {marker} {col_name:<20} {col_type:<10} {is_nullable:<8} {default_val}")
                    
            except sqlite3.Error as e:
                print(f"❌ Error getting schema for {table}: {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing Sync Columns Implementation")
    print()
    
    test_sync_columns()
    
    response = input("\nShow detailed table schemas? (y/n): ")
    if response.lower() == 'y':
        show_table_schemas()
