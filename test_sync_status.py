#!/usr/bin/env python3
"""
Test script to check database status and sync functionality
"""
import sqlite3
import os
from datetime import datetime

# Database path
DB_PATH = "/home/deniskariuki/.local/share/library-management-system/library.db"

def check_database_status():
    """Check the current status of the local database"""
    print("🔍 Checking Local Database Status...")
    print(f"📁 Database Path: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("❌ Database file not found!")
        return False
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check tables and record counts
        tables = [
            'books', 'students', 'borrowings', 'categories', 
            'classes', 'book_copies', 'staff', 'fines'
        ]
        
        print("\n📊 Table Record Counts:")
        total_records = 0
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table:15}: {count:6} records")
                total_records += count
            except sqlite3.Error as e:
                print(f"  {table:15}: ❌ Error - {e}")
        
        print(f"\n📈 Total Records: {total_records}")
        
        # Check sync status
        print("\n🔄 Sync Status Check:")
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0")
                unsynced = cursor.fetchone()[0]
                cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 1")
                synced = cursor.fetchone()[0]
                
                if unsynced > 0 or synced > 0:
                    print(f"  {table:15}: {synced:4} synced, {unsynced:4} unsynced")
            except sqlite3.Error as e:
                print(f"  {table:15}: ❌ No sync column - {e}")
        
        # Check recent activity
        print("\n⏰ Recent Activity:")
        try:
            cursor.execute("""
                SELECT 'borrowings' as table_name, COUNT(*) as count 
                FROM borrowings 
                WHERE datetime(updated_at) > datetime('now', '-7 days')
                UNION ALL
                SELECT 'books' as table_name, COUNT(*) as count 
                FROM books 
                WHERE datetime(updated_at) > datetime('now', '-7 days')
                UNION ALL
                SELECT 'students' as table_name, COUNT(*) as count 
                FROM students 
                WHERE datetime(updated_at) > datetime('now', '-7 days')
            """)
            
            for row in cursor.fetchall():
                if row[1] > 0:
                    print(f"  {row[0]:15}: {row[1]} records updated in last 7 days")
        
        except sqlite3.Error as e:
            print(f"  ❌ Error checking recent activity: {e}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database connection error: {e}")
        return False

def check_schema_compatibility():
    """Check if the schema matches the new Supabase requirements"""
    print("\n🔧 Schema Compatibility Check...")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check for required columns in borrowings table
        required_borrowings_columns = [
            'book_copy_id', 'borrower_type', 'staff_id', 'condition_at_issue',
            'condition_at_return', 'tracking_code', 'return_notes', 'synced'
        ]
        
        cursor.execute("PRAGMA table_info(borrowings)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        print("📋 Borrowings Table Column Check:")
        for col in required_borrowings_columns:
            if col in existing_columns:
                print(f"  ✅ {col}")
            else:
                print(f"  ❌ {col} - MISSING")
        
        # Check for required tables
        required_tables = [
            'books', 'students', 'borrowings', 'categories', 'classes',
            'book_copies', 'staff', 'fines', 'group_borrowings', 'theft_reports'
        ]
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        print("\n📋 Required Tables Check:")
        for table in required_tables:
            if table in existing_tables:
                print(f"  ✅ {table}")
            else:
                print(f"  ❌ {table} - MISSING")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Schema check error: {e}")

def main():
    print("🚀 Library Management System - Database Test")
    print("=" * 50)
    
    if check_database_status():
        check_schema_compatibility()
        
        print("\n✅ Database check completed!")
        print("\n💡 Next Steps:")
        print("1. Start your Tauri app: npm run tauri dev")
        print("2. Run migration: invoke('run_database_migration')")
        print("3. Test sync: invoke('run_improved_bidirectional_sync')")
    else:
        print("\n❌ Database check failed!")
        print("💡 Try starting the Tauri app first to initialize the database")

if __name__ == "__main__":
    main()
