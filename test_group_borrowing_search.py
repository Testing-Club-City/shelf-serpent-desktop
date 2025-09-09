#!/usr/bin/env python3
"""
Test script to verify local database queries for group borrowings
and search functionality for students and books.
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
    
    # Check if table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='group_borrowings'
    """)
    
    if not cursor.fetchone():
        print("❌ group_borrowings table does not exist")
        return False
    
    print("✅ group_borrowings table exists")
    
    # Get table structure
    cursor.execute("PRAGMA table_info(group_borrowings)")
    columns = cursor.fetchall()
    print("📊 group_borrowings table structure:")
    for col in columns:
        print(f"  {col[1]}: {col[2]} (nullable: {not col[3]})")
    
    # Count records
    cursor.execute("SELECT COUNT(*) FROM group_borrowings")
    count = cursor.fetchone()[0]
    print(f"📊 Total group borrowings in local database: {count}")
    
    # Get sample records
    cursor.execute("SELECT * FROM group_borrowings LIMIT 5")
    records = cursor.fetchall()
    
    if records:
        print("📋 Sample group borrowings:")
        for record in records:
            print(f"  {record}")
    else:
        print("⚠️ No group borrowings found in local database")
    
    return count

def test_student_search_functionality(conn):
    """Test student search functionality"""
    cursor = conn.cursor()
    
    print("\n🔍 Testing student search functionality...")
    
    # Check students table
    cursor.execute("SELECT COUNT(*) FROM students")
    student_count = cursor.fetchone()[0]
    print(f"📊 Total students in local database: {student_count}")
    
    if student_count == 0:
        print("⚠️ No students found - search will fail")
        return False
    
    # Test search by admission number
    search_query = "20232"
    cursor.execute("""
        SELECT * FROM students 
        WHERE admission_number LIKE ? OR first_name LIKE ? OR last_name LIKE ?
    """, (f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"))
    
    students = cursor.fetchall()
    print(f"🔍 Students matching '{search_query}': {len(students)}")
    
    for student in students:
        print(f"  ID: {student[0]}, Name: {student[1]} {student[2]}, Admission: {student[6]}")
    
    return len(students) > 0

def test_book_search_functionality(conn):
    """Test book search functionality"""
    cursor = conn.cursor()
    
    print("\n📚 Testing book search functionality...")
    
    # Check books table
    cursor.execute("SELECT COUNT(*) FROM books")
    book_count = cursor.fetchone()[0]
    print(f"📊 Total books in local database: {book_count}")
    
    if book_count == 0:
        print("⚠️ No books found - search will fail")
        return False
    
    # Test search by tracking code (from book_copies)
    cursor.execute("""
        SELECT bc.*, b.title, b.author 
        FROM book_copies bc
        JOIN books b ON bc.isbn = b.isbn
        WHERE bc.tracking_code LIKE ?
    """, ("%BOOK-263600%",))
    
    books = cursor.fetchall()
    print(f"📚 Books matching tracking code: {len(books)}")
    
    for book in books:
        print(f"  Tracking: {book[10]}, Title: {book[2]}, Author: {book[3]}")
    
    return len(books) > 0

def test_group_borrowing_search_integration(conn):
    """Test how group borrowings search students and books"""
    cursor = conn.cursor()
    
    print("\n🔗 Testing group borrowing search integration...")
    
    # Test if we can find students by IDs stored in group_borrowings
    cursor.execute("""
        SELECT gb.id, gb.book_id, s.first_name, s.last_name, s.admission_number
        FROM group_borrowings gb
        JOIN students s ON gb.book_id = s.id
        LIMIT 3
    """)
    
    results = cursor.fetchall()
    print(f"🔗 Group borrowing student integration: {len(results)} records")
    
    for result in results:
        print(f"  Group ID: {result[0]}, Student: {result[2]} {result[3]} ({result[4]})")
    
    return len(results) > 0

def test_schema_alignment():
    """Test if schemas are properly aligned"""
    conn = test_local_database_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Test all required tables exist
        tables = ['students', 'books', 'book_copies', 'group_borrowings']
        for table in tables:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not cursor.fetchone():
                print(f"❌ Missing table: {table}")
                return False
            else:
                print(f"✅ Table exists: {table}")
        
        # Test foreign key relationships
        cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM students) as student_count,
                (SELECT COUNT(*) FROM books) as book_count,
                (SELECT COUNT(*) FROM group_borrowings) as group_count
        """)
        
        counts = cursor.fetchone()
        print(f"\n📊 Database summary:")
        print(f"  Students: {counts[0]}")
        print(f"  Books: {counts[1]}")
        print(f"  Group borrowings: {counts[2]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Schema alignment test failed: {e}")
        return False
    finally:
        conn.close()

def main():
    """Main test function"""
    print("🧪 Testing Group Borrowing Local Database Queries")
    print("=" * 60)
    
    # Test database connection
    conn = test_local_database_connection()
    if not conn:
        return
    
    try:
        # Test group borrowings
        group_count = test_group_borrowings_table(conn)
        
        # Test search functionality
        student_search_works = test_student_search_functionality(conn)
        book_search_works = test_book_search_functionality(conn)
        integration_works = test_group_borrowing_search_integration(conn)
        
        print("\n" + "=" * 60)
        print("📋 TEST RESULTS:")
        print(f"  Group borrowings in local DB: {group_count}")
        print(f"  Student search works: {student_search_works}")
        print(f"  Book search works: {book_search_works}")
        print(f"  Integration works: {integration_works}")
        
        if group_count == 0:
            print("\n⚠️ WARNING: No group borrowings found locally!")
            print("   This explains why group borrowing features aren't working")
            print("   Run sync to pull missing data from Supabase")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
