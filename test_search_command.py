#!/usr/bin/env python3
"""
Test script to verify the global search functionality is working
"""
import sqlite3
import json

def test_database_search():
    """Test the database directly to see if search would work"""
    db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Test search for admission number 20232
        print("🔍 Testing search for admission number '20232'...")
        
        # Search students
        cursor.execute("""
            SELECT id, admission_number, first_name, last_name, class_grade, email, phone
            FROM students 
            WHERE LOWER(admission_number) LIKE LOWER(?) 
               OR LOWER(first_name) LIKE LOWER(?) 
               OR LOWER(last_name) LIKE LOWER(?)
            LIMIT 5
        """, ('%20232%', '%20232%', '%20232%'))
        
        students = cursor.fetchall()
        print(f"📚 Found {len(students)} students:")
        for student in students:
            print(f"  - {student['admission_number']}: {student['first_name']} {student['last_name']}")
        
        # Test search for a book title
        print("\n🔍 Testing search for 'math'...")
        cursor.execute("""
            SELECT id, title, author, isbn
            FROM books 
            WHERE LOWER(title) LIKE LOWER(?) 
               OR LOWER(author) LIKE LOWER(?)
            LIMIT 5
        """, ('%math%', '%math%'))
        
        books = cursor.fetchall()
        print(f"📖 Found {len(books)} books:")
        for book in books:
            print(f"  - {book['title']} by {book['author']}")
            
        # Test search for legacy book ID
        print("\n🔍 Testing search for legacy book ID '307'...")
        cursor.execute("""
            SELECT bc.id, bc.legacy_book_id, bc.copy_identifier, bc.status, bc.title, bc.author
            FROM book_copies bc
            WHERE bc.legacy_book_id = ?
            LIMIT 5
        """, ('307',))
        
        copies = cursor.fetchall()
        print(f"📋 Found {len(copies)} book copies:")
        for copy in copies:
            print(f"  - Legacy ID {copy['legacy_book_id']}: {copy['title']} ({copy['status']})")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

if __name__ == "__main__":
    test_database_search()