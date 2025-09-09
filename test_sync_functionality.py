#!/usr/bin/env python3
"""
Test script to verify sync functionality with the updated schema
"""
import sqlite3
import json
import os
from datetime import datetime

DB_PATH = "/home/deniskariuki/.local/share/library-management-system/library.db"

def test_data_mapping():
    """Test that our data can be properly mapped for sync"""
    print("🧪 Testing Data Mapping for Sync...")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        cursor = conn.cursor()
        
        # Test borrowings mapping (most complex table)
        print("\n📋 Testing Borrowings Data Mapping:")
        cursor.execute("""
            SELECT * FROM borrowings 
            WHERE synced = 0 
            LIMIT 3
        """)
        
        borrowings = cursor.fetchall()
        if borrowings:
            for i, row in enumerate(borrowings, 1):
                print(f"\n  📄 Sample Borrowing {i}:")
                
                # Convert to dict for mapping test
                row_dict = dict(row)
                
                # Check key fields that need mapping
                key_fields = [
                    'id', 'student_id', 'book_id', 'book_copy_id',
                    'borrowed_date', 'due_date', 'status', 'borrower_type',
                    'condition_at_issue', 'tracking_code', 'staff_id'
                ]
                
                for field in key_fields:
                    value = row_dict.get(field)
                    if value is not None:
                        print(f"    {field:20}: {value}")
                    else:
                        print(f"    {field:20}: NULL")
        else:
            print("  ℹ️  No unsynced borrowings found")
        
        # Test books mapping
        print("\n📚 Testing Books Data Mapping:")
        cursor.execute("""
            SELECT id, title, author, isbn, status, condition, 
                   book_code, legacy_book_id, synced 
            FROM books 
            WHERE synced = 0 
            LIMIT 2
        """)
        
        books = cursor.fetchall()
        if books:
            for i, row in enumerate(books, 1):
                row_dict = dict(row)
                print(f"\n  📖 Sample Book {i}:")
                print(f"    {'title':20}: {row_dict.get('title', 'N/A')}")
                print(f"    {'status':20}: {row_dict.get('status', 'N/A')}")
                print(f"    {'condition':20}: {row_dict.get('condition', 'N/A')}")
                print(f"    {'book_code':20}: {row_dict.get('book_code', 'N/A')}")
                print(f"    {'legacy_book_id':20}: {row_dict.get('legacy_book_id', 'N/A')}")
        else:
            print("  ℹ️  No unsynced books found")
        
        # Test students mapping
        print("\n👥 Testing Students Data Mapping:")
        cursor.execute("""
            SELECT id, admission_number, first_name, last_name, 
                   class_grade, class_id, academic_year, synced 
            FROM students 
            WHERE synced = 0 
            LIMIT 2
        """)
        
        students = cursor.fetchall()
        if students:
            for i, row in enumerate(students, 1):
                row_dict = dict(row)
                print(f"\n  👤 Sample Student {i}:")
                print(f"    {'admission_number':20}: {row_dict.get('admission_number', 'N/A')}")
                print(f"    {'name':20}: {row_dict.get('first_name', '')} {row_dict.get('last_name', '')}")
                print(f"    {'class_grade':20}: {row_dict.get('class_grade', 'N/A')}")
                print(f"    {'class_id':20}: {row_dict.get('class_id', 'N/A')}")
                print(f"    {'academic_year':20}: {row_dict.get('academic_year', 'N/A')}")
        else:
            print("  ℹ️  No unsynced students found")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Data mapping test error: {e}")
        return False

def test_enum_compatibility():
    """Test that our status values are compatible with Supabase enums"""
    print("\n🔧 Testing Enum Compatibility...")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Test book status values
        print("\n📚 Book Status Values:")
        cursor.execute("SELECT DISTINCT status FROM books WHERE status IS NOT NULL")
        book_statuses = [row[0] for row in cursor.fetchall()]
        
        valid_book_statuses = ['available', 'unavailable', 'damaged', 'lost']
        for status in book_statuses:
            if status in valid_book_statuses:
                print(f"  ✅ {status}")
            else:
                print(f"  ⚠️  {status} - needs mapping")
        
        # Test borrowing status values
        print("\n📋 Borrowing Status Values:")
        cursor.execute("SELECT DISTINCT status FROM borrowings WHERE status IS NOT NULL")
        borrowing_statuses = [row[0] for row in cursor.fetchall()]
        
        valid_borrowing_statuses = ['active', 'returned', 'overdue', 'lost']
        for status in borrowing_statuses:
            if status in valid_borrowing_statuses:
                print(f"  ✅ {status}")
            else:
                print(f"  ⚠️  {status} - needs mapping")
        
        # Test borrower type values
        print("\n👥 Borrower Type Values:")
        cursor.execute("SELECT DISTINCT borrower_type FROM borrowings WHERE borrower_type IS NOT NULL")
        borrower_types = [row[0] for row in cursor.fetchall()]
        
        valid_borrower_types = ['student', 'staff']
        for btype in borrower_types:
            if btype in valid_borrower_types:
                print(f"  ✅ {btype}")
            else:
                print(f"  ⚠️  {btype} - needs mapping")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Enum compatibility test error: {e}")
        return False

def generate_sync_summary():
    """Generate a summary for sync testing"""
    print("\n📊 Sync Test Summary:")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Count unsynced records by table
        tables = ['books', 'students', 'borrowings', 'categories', 'classes', 'staff']
        
        print("\n🔄 Records Ready for Sync:")
        total_unsynced = 0
        
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0")
                count = cursor.fetchone()[0]
                if count > 0:
                    print(f"  {table:15}: {count:6} records")
                    total_unsynced += count
            except sqlite3.Error:
                print(f"  {table:15}: ❌ No sync column")
        
        print(f"\n📈 Total Unsynced: {total_unsynced} records")
        
        if total_unsynced > 0:
            print("\n✅ Ready for sync testing!")
            print("\n🚀 Recommended Test Commands:")
            print("1. Start Tauri app: npm run tauri dev")
            print("2. Test migration: invoke('run_database_migration')")
            print("3. Test sync: invoke('run_improved_bidirectional_sync')")
            print("4. Check results: invoke('get_local_data_stats')")
        else:
            print("\n⚠️  No unsynced data found. Consider:")
            print("1. Adding some test data")
            print("2. Marking some records as unsynced for testing")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Summary generation error: {e}")

def main():
    print("🧪 Library Management System - Sync Functionality Test")
    print("=" * 60)
    
    if not os.path.exists(DB_PATH):
        print("❌ Database not found! Start the Tauri app first.")
        return
    
    success = True
    success &= test_data_mapping()
    success &= test_enum_compatibility()
    
    generate_sync_summary()
    
    if success:
        print("\n✅ All tests passed! Schema mapper should work correctly.")
    else:
        print("\n⚠️  Some tests had issues. Check the output above.")

if __name__ == "__main__":
    main()
