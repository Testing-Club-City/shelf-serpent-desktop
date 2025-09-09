#!/usr/bin/env python3
"""
Fixed test script to verify local database queries for group borrowings
with correct schema mapping and search functionality.
"""

import sqlite3
import os
from pathlib import Path
import json

def get_db_path():
    """Get the correct database path"""
    app_dir = Path.home() / "AppData" / "Roaming" / "library-management-system"
    return app_dir / "library.db"

def test_local_database_connection():
    """Test connection to local SQLite database"""
    db_path = get_db_path()
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        print(f"✅ Successfully connected to local database: {db_path}")
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return False

def test_group_borrowings_table(conn):
    """Test group_borrowings table structure and data"""
    cursor = conn.cursor()
    
    # Count records
    cursor.execute("SELECT COUNT(*) FROM group_borrowings")
    count = cursor.fetchone()[0]
    print(f"📊 Total group borrowings in local database: {count}")
    
    # Get sample records with student details
    cursor.execute("""
        SELECT gb.id, gb.book_id, gb.student_ids, gb.student_count,
               gb.tracking_code, gb.borrowed_date, gb.status
        FROM group_borrowings gb
        LIMIT 5
    """)
    records = cursor.fetchall()
    
    if records:
        print("📋 Sample group borrowings:")
        for record in records:
            print(f"  ID: {record[0]}")
            print(f"  Book ID: {record[1]}")
            print(f"  Student IDs: {record[2]}")
            print(f"  Student Count: {record[3]}")
            print(f"  Tracking Code: {record[4]}")
            print(f"  Date: {record[5]}, Status: {record[6]}")
            print("  " + "-" * 40)
    
    return count

def test_student_search_functionality(conn):
    """Test student search functionality"""
    cursor = conn.cursor()
    
    print("\n🔍 Testing student search functionality...")
    
    # Check students table
    cursor.execute("SELECT COUNT(*) FROM students")
    student_count = cursor.fetchone()[0]
    print(f"📊 Total students in local database: {student_count}")
    
    # Test search by admission number
    cursor.execute("""
        SELECT id, first_name, last_name, admission_number, class_grade
        FROM students 
        WHERE admission_number LIKE ? OR first_name LIKE ? OR last_name LIKE ?
        LIMIT 5
    """, ("%20232%", "%20232%", "%20232%"))
    
    students = cursor.fetchall()
    print(f"🔍 Sample student search results: {len(students)}")
    
    for student in students:
        print(f"  ID: {student[0]}, Name: {student[1]} {student[2]}, Admission: {student[3]}, Class: {student[4]}")
    
    return student_count

def test_book_search_functionality(conn):
    """Test book search functionality with correct schema"""
    cursor = conn.cursor()
    
    print("\n📚 Testing book search functionality...")
    
    # Check books table
    cursor.execute("SELECT COUNT(*) FROM books")
    book_count = cursor.fetchone()[0]
    print(f"📊 Total books in local database: {book_count}")
    
    # Test book search by ISBN/title
    cursor.execute("""
        SELECT b.isbn, b.title, b.author, bc.tracking_code
        FROM books b
        LEFT JOIN book_copies bc ON b.isbn = bc.isbn
        WHERE b.title LIKE ? OR b.isbn LIKE ? OR bc.tracking_code LIKE ?
        LIMIT 5
    """, ("%BOOK%", "%BOOK%", "%BOOK%"))
    
    books = cursor.fetchall()
    print(f"📚 Sample book search results: {len(books)}")
    
    for book in books:
        print(f"  ISBN: {book[0]}, Title: {book[1]}, Author: {book[2]}, Tracking: {book[3]}")
    
    return book_count

def test_group_borrowing_student_mapping(conn):
    """Test how group borrowings should map to students"""
    cursor = conn.cursor()
    
    print("\n🔗 Testing group borrowing student mapping...")
    
    # Check if student_ids field is properly populated
    cursor.execute("""
        SELECT gb.id, gb.student_ids, gb.student_count,
               s.id, s.first_name, s.last_name
        FROM group_borrowings gb
        LEFT JOIN students s ON gb.student_ids LIKE '%' || s.id || '%'
        WHERE gb.student_ids IS NOT NULL AND gb.student_ids != '[]'
        LIMIT 5
    """)
    
    mappings = cursor.fetchall()
    print(f"🔗 Group borrowing student mappings: {len(mappings)}")
    
    for mapping in mappings:
        print(f"  Group ID: {mapping[0]}")
        print(f"  Student IDs: {mapping[1]}")
        print(f"  Student Count: {mapping[2]}")
        if mapping[3]:
            print(f"  Matched Student: {mapping[4]} {mapping[5]}")
    
    return len(mappings)

def test_schema_issues(conn):
    """Test for schema issues in group borrowing search"""
    cursor = conn.cursor()
    
    print("\n⚠️ Testing for schema issues...")
    
    # Check if student_ids is empty
    cursor.execute("""
        SELECT COUNT(*) FROM group_borrowings 
        WHERE student_ids IS NULL OR student_ids = '[]' OR student_ids = ''
    """)
    empty_student_ids = cursor.fetchone()[0]
    
    # Check if book_id references exist
    cursor.execute("""
        SELECT COUNT(*) FROM group_borrowings gb
        LEFT JOIN books b ON gb.book_id = b.isbn
        WHERE b.isbn IS NULL
    """)
    invalid_book_refs = cursor.fetchone()[0]
    
    print(f"❌ Empty student_ids count: {empty_student_ids}")
    print(f"❌ Invalid book references: {invalid_book_refs}")
    
    return empty_student_ids == 0 and invalid_book_refs == 0

def main():
    """Main test function"""
    print("🧪 Testing Group Borrowing Local Database Queries")
    print("=" * 60)
    
    # Test database connection
    conn = test_local_database_connection()
    if not conn:
        return
    
    try:
        # Test all functionality
        group_count = test_group_borrowings_table(conn)
        student_count = test_student_search_functionality(conn)
        book_count = test_book_search_functionality(conn)
        mapping_count = test_group_borrowing_student_mapping(conn)
        schema_ok = test_schema_issues(conn)
        
        print("\n" + "=" * 60)
        print("📋 TEST RESULTS:")
        print(f"  Group borrowings: {group_count}")
        print(f"  Students: {student_count}")
        print(f"  Books: {book_count}")
        print(f"  Student mappings: {mapping_count}")
        print(f"  Schema issues: {'None' if schema_ok else 'Found'}")
        
        # Identify specific issues
        if group_count > 0:
            print("\n🔍 ISSUES IDENTIFIED:")
            print("1. student_ids field is empty '[]' - needs proper student ID storage")
            print("2. Book references may be using book_id instead of ISBN")
            print("3. Search functionality needs to handle JSON arrays in student_ids")
            
    finally:
        conn.close()

if __name__ == "__main__":
    main()
