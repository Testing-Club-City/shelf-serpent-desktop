#!/usr/bin/env python3
"""
Test script to verify the global search functionality
"""

import sqlite3
import json
import os

def find_database():
    """Find the SQLite database file in the correct app data directory"""
    # Use the exact path provided by the user
    db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
    
    if os.path.exists(db_path):
        print(f"✅ Found database at: {db_path}")
        return db_path
    else:
        print(f"❌ Database not found at: {db_path}")
        return None

def test_student_search(db_path, admission_number):
    """Test searching for students by admission number"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    print(f"\n🔍 Testing student search for admission number: {admission_number}")
    
    # Test the exact query from the enhanced_global_search method
    cursor = conn.execute("""
        SELECT id, first_name, last_name, admission_number, class_grade, email, phone_number, created_at
        FROM students 
        WHERE (deleted = 0 OR deleted IS NULL) 
          AND (admission_number = ? OR admission_number LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
        ORDER BY 
          CASE WHEN admission_number = ? THEN 0 ELSE 1 END,
          first_name, last_name
        LIMIT ?
    """, (admission_number, f"%{admission_number.lower()}%", f"%{admission_number.lower()}%", 
          f"%{admission_number.lower()}%", admission_number, "15"))
    
    students = cursor.fetchall()
    print(f"📚 Found {len(students)} students:")
    for student in students:
        print(f"  - ID: {student['id']}")
        print(f"    Name: {student['first_name']} {student['last_name']}")
        print(f"    Admission: {student['admission_number']}")
        print(f"    Class: {student['class_grade']}")
        print(f"    Email: {student['email']}")
        print()
    
    # Also test a simpler query
    print(f"\n🔍 Testing simple student search:")
    cursor = conn.execute("""
        SELECT id, first_name, last_name, admission_number, class_grade
        FROM students 
        WHERE admission_number = ?
    """, (admission_number,))
    
    simple_students = cursor.fetchall()
    print(f"📚 Simple search found {len(simple_students)} students:")
    for student in simple_students:
        print(f"  - {student['first_name']} {student['last_name']} ({student['admission_number']})")
    
    conn.close()

def test_borrowing_search(db_path, admission_number):
    """Test searching for borrowings by admission number"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    print(f"\n🔍 Testing borrowing search for admission number: {admission_number}")
    
    cursor = conn.execute("""
        SELECT b.id, b.borrowed_date, b.due_date, b.status, b.tracking_code,
               s.first_name, s.last_name, s.admission_number,
               COALESCE(bk.title, bc.title, 'Unknown Title') as book_title,
               COALESCE(bk.author, bc.author, 'Unknown Author') as book_author,
               bc.legacy_book_id, bc.copy_identifier,
               b.created_at
        FROM borrowings b
        LEFT JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
        LEFT JOIN books bk ON b.book_id = bk.id AND (bk.deleted = 0 OR bk.deleted IS NULL)
        LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
        WHERE (b.deleted = 0 OR b.deleted IS NULL) 
          AND b.status = 'active'
          AND (bc.legacy_book_id = ? OR s.admission_number = ? OR b.tracking_code LIKE ?)
        ORDER BY 
          CASE WHEN bc.legacy_book_id = ? THEN 0 
               WHEN s.admission_number = ? THEN 1 
               ELSE 2 END,
          b.borrowed_date DESC
        LIMIT ?
    """, (admission_number, admission_number, f"%{admission_number.lower()}%",
          admission_number, admission_number, "15"))
    
    borrowings = cursor.fetchall()
    print(f"📋 Found {len(borrowings)} active borrowings:")
    for borrowing in borrowings:
        print(f"  - Book: {borrowing['book_title']}")
        print(f"    Student: {borrowing['first_name']} {borrowing['last_name']} ({borrowing['admission_number']})")
        print(f"    Legacy ID: {borrowing['legacy_book_id']}")
        print(f"    Due: {borrowing['due_date']}")
        print()
    
    conn.close()

def main():
    db_path = find_database()
    if not db_path:
        return
    
    # Test with the admission number from the screenshot
    test_student_search(db_path, "20232")
    test_borrowing_search(db_path, "20232")

if __name__ == "__main__":
    main()