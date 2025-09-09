#!/usr/bin/env python3
"""
Debug borrowing table schema and data reading process
"""

import sqlite3
from pathlib import Path
import json

def debug_borrowing_schema():
    """Debug the borrowing table schema and data reading"""
    
    db_path = Path.home() / "AppData/Roaming/library-management-system/library.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"🔍 DEBUGGING BORROWING TABLE SCHEMA AND DATA READING")
    print(f"Database: {db_path}")
    print("=" * 80)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. Check borrowings table schema
        print(f"\n📋 BORROWINGS TABLE SCHEMA:")
        cursor.execute("PRAGMA table_info(borrowings)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"   {col['name']} ({col['type']}) - {'NOT NULL' if col['notnull'] else 'NULL'} - Default: {col['dflt_value']}")
        
        # 2. Check total borrowings count
        print(f"\n📊 BORROWINGS DATA COUNTS:")
        cursor.execute("SELECT COUNT(*) as total FROM borrowings")
        total = cursor.fetchone()['total']
        print(f"   Total borrowings: {total}")
        
        # 3. Check borrowings by status
        cursor.execute("SELECT status, COUNT(*) as count FROM borrowings GROUP BY status")
        statuses = cursor.fetchall()
        print(f"   Borrowings by status:")
        for status in statuses:
            print(f"     - {status['status']}: {status['count']}")
        
        # 4. Check borrowings by deleted flag
        cursor.execute("SELECT deleted, COUNT(*) as count FROM borrowings GROUP BY deleted")
        deleted_counts = cursor.fetchall()
        print(f"   Borrowings by deleted flag:")
        for deleted in deleted_counts:
            deleted_val = deleted['deleted']
            if deleted_val is None:
                deleted_str = "NULL"
            elif deleted_val == 0:
                deleted_str = "0 (not deleted)"
            elif deleted_val == 1:
                deleted_str = "1 (deleted)"
            else:
                deleted_str = str(deleted_val)
            print(f"     - {deleted_str}: {deleted['count']}")
        
        # 5. Test the exact query the backend uses
        print(f"\n🔍 TESTING BACKEND QUERY (get_borrowings_with_details):")
        backend_query = """
            SELECT 
                b.id, b.student_id, b.book_id, b.borrowed_date, b.due_date, b.returned_date,
                b.status, b.fine_amount, b.notes, b.issued_by, b.returned_by, b.created_at, b.updated_at,
                b.fine_paid, b.book_copy_id, b.condition_at_issue, b.condition_at_return, b.is_lost,
                b.tracking_code, b.return_notes, b.copy_condition, b.group_borrowing_id, b.borrower_type, b.staff_id,
                s.first_name as student_first_name, s.last_name as student_last_name, s.admission_number, s.class_grade,
                bc.title as book_title, bc.author as book_author, bc.isbn as book_code,
                bc.copy_identifier as copy_number, bc.condition as copy_condition_status
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id AND s.deleted = 0
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND bc.deleted = 0
            WHERE b.deleted = 0
            ORDER BY b.created_at DESC
            LIMIT 5
        """
        
        try:
            cursor.execute(backend_query)
            results = cursor.fetchall()
            print(f"   Backend query returned: {len(results)} results")
            
            if results:
                for i, row in enumerate(results):
                    print(f"\n   --- Borrowing {i+1} ---")
                    print(f"   ID: {row['id']}")
                    print(f"   Status: {row['status']}")
                    print(f"   Borrower Type: {row['borrower_type']}")
                    print(f"   Student: {row['student_first_name']} {row['student_last_name']}")
                    print(f"   Book Title: '{row['book_title']}'")
                    print(f"   Book Author: '{row['book_author']}'")
                    print(f"   Borrowed Date: {row['borrowed_date']}")
                    print(f"   Due Date: {row['due_date']}")
                    
                    # Check if this would create a valid books object
                    if row['book_title']:
                        print(f"   ✅ Will create books object with title")
                    else:
                        print(f"   ❌ No book title - books object will be null")
            else:
                print(f"   ❌ No results returned from backend query")
                
        except Exception as e:
            print(f"   ❌ Backend query failed: {e}")
        
        # 6. Check if there are issues with the WHERE clause
        print(f"\n🔍 TESTING WHERE CLAUSE CONDITIONS:")
        
        # Test without WHERE clause
        cursor.execute("SELECT COUNT(*) as count FROM borrowings")
        total_no_where = cursor.fetchone()['count']
        print(f"   Total borrowings (no WHERE): {total_no_where}")
        
        # Test with deleted = 0
        cursor.execute("SELECT COUNT(*) as count FROM borrowings WHERE deleted = 0")
        not_deleted = cursor.fetchone()['count']
        print(f"   Borrowings with deleted = 0: {not_deleted}")
        
        # Test with deleted IS NULL
        cursor.execute("SELECT COUNT(*) as count FROM borrowings WHERE deleted IS NULL")
        null_deleted = cursor.fetchone()['count']
        print(f"   Borrowings with deleted IS NULL: {null_deleted}")
        
        # Test with deleted != 1
        cursor.execute("SELECT COUNT(*) as count FROM borrowings WHERE deleted != 1 OR deleted IS NULL")
        not_deleted_alt = cursor.fetchone()['count']
        print(f"   Borrowings with deleted != 1 OR NULL: {not_deleted_alt}")
        
        # 7. Check students table
        print(f"\n👥 STUDENTS TABLE CHECK:")
        cursor.execute("SELECT COUNT(*) as total FROM students")
        total_students = cursor.fetchone()['total']
        print(f"   Total students: {total_students}")
        
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE deleted = 0")
        active_students = cursor.fetchone()['count']
        print(f"   Active students (deleted = 0): {active_students}")
        
        # 8. Check book_copies table
        print(f"\n📚 BOOK_COPIES TABLE CHECK:")
        cursor.execute("SELECT COUNT(*) as total FROM book_copies")
        total_copies = cursor.fetchone()['total']
        print(f"   Total book copies: {total_copies}")
        
        cursor.execute("SELECT COUNT(*) as count FROM book_copies WHERE deleted = 0")
        active_copies = cursor.fetchone()['count']
        print(f"   Active book copies (deleted = 0): {active_copies}")
        
        cursor.execute("SELECT COUNT(*) as count FROM book_copies WHERE deleted = 0 AND title IS NOT NULL AND title != ''")
        copies_with_titles = cursor.fetchone()['count']
        print(f"   Active copies with titles: {copies_with_titles}")
        
        # 9. Check JOIN relationships
        print(f"\n🔗 JOIN RELATIONSHIPS CHECK:")
        
        # Check borrowings with valid student references
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM borrowings b 
            INNER JOIN students s ON b.student_id = s.id 
            WHERE b.deleted = 0 AND s.deleted = 0
        """)
        valid_student_joins = cursor.fetchone()['count']
        print(f"   Borrowings with valid student references: {valid_student_joins}")
        
        # Check borrowings with valid book_copy references
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM borrowings b 
            INNER JOIN book_copies bc ON b.book_copy_id = bc.id 
            WHERE b.deleted = 0 AND bc.deleted = 0
        """)
        valid_copy_joins = cursor.fetchone()['count']
        print(f"   Borrowings with valid book_copy references: {valid_copy_joins}")
        
        # Check borrowings with both valid references
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM borrowings b 
            INNER JOIN students s ON b.student_id = s.id 
            INNER JOIN book_copies bc ON b.book_copy_id = bc.id 
            WHERE b.deleted = 0 AND s.deleted = 0 AND bc.deleted = 0
        """)
        valid_both_joins = cursor.fetchone()['count']
        print(f"   Borrowings with both valid references: {valid_both_joins}")
        
        # 10. Sample some raw borrowing data
        print(f"\n📝 SAMPLE RAW BORROWING DATA:")
        cursor.execute("""
            SELECT id, student_id, book_copy_id, status, borrower_type, deleted, created_at 
            FROM borrowings 
            ORDER BY created_at DESC 
            LIMIT 3
        """)
        samples = cursor.fetchall()
        for i, row in enumerate(samples):
            print(f"   --- Sample {i+1} ---")
            print(f"   ID: {row['id']}")
            print(f"   Student ID: {row['student_id']}")
            print(f"   Book Copy ID: {row['book_copy_id']}")
            print(f"   Status: {row['status']}")
            print(f"   Borrower Type: {row['borrower_type']}")
            print(f"   Deleted: {row['deleted']}")
            print(f"   Created: {row['created_at']}")
        
        conn.close()
        
        print(f"\n💡 DIAGNOSIS:")
        if not_deleted > 0:
            print(f"   ✅ Found {not_deleted} non-deleted borrowings")
            if valid_both_joins > 0:
                print(f"   ✅ Found {valid_both_joins} borrowings with valid student and book references")
                print(f"   🔍 Issue might be in the frontend data processing or query execution")
            else:
                print(f"   ❌ No borrowings have valid student AND book_copy references")
                print(f"   🔍 Issue is with data integrity - missing foreign key relationships")
        else:
            print(f"   ❌ No non-deleted borrowings found")
            print(f"   🔍 All borrowings are marked as deleted or there's an issue with the deleted flag")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_borrowing_schema()