#!/usr/bin/env python3
"""
Test script to verify legacy ID queries work correctly
"""

import sqlite3
import json
import os

def find_database():
    """Find the SQLite database file"""
    possible_paths = [
        "library.db",
        "src-tauri/library.db", 
        "database.db",
        "src-tauri/database.db"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            print(f"✅ Found database at: {path}")
            return path
    
    print("❌ No database found")
    return None

def test_legacy_id_search(db_path, legacy_id):
    """Test searching for borrowings by legacy ID"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    print(f"\n🔍 Testing legacy ID search for: {legacy_id}")
    
    # First, check if the legacy ID exists in book_copies
    cursor = conn.execute("""
        SELECT id, legacy_book_id, title, author, status, tracking_code
        FROM book_copies 
        WHERE legacy_book_id = ?
    """, (legacy_id,))
    
    book_copies = cursor.fetchall()
    print(f"📚 Found {len(book_copies)} book copies with legacy ID {legacy_id}:")
    for copy in book_copies:
        print(f"  - ID: {copy['id']}, Title: {copy['title']}, Status: {copy['status']}, Tracking: {copy['tracking_code']}")
    
    if not book_copies:
        print(f"❌ No book copies found with legacy ID {legacy_id}")
        return
    
    # Now check for active borrowings
    cursor = conn.execute("""
        SELECT 
            b.id, b.student_id, b.book_id, b.book_copy_id, b.borrowed_date, b.due_date,
            b.status, b.tracking_code, b.notes,
            s.first_name, s.last_name, s.admission_number, s.class_grade,
            bk.title, bk.author, bk.isbn,
            bc.legacy_book_id, bc.copy_identifier, bc.condition
        FROM borrowings b
        LEFT JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
        LEFT JOIN books bk ON b.book_id = bk.id AND (bk.deleted = 0 OR bk.deleted IS NULL)
        LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
        WHERE b.status = 'active' 
          AND bc.legacy_book_id = ? 
          AND (b.deleted = 0 OR b.deleted IS NULL)
        ORDER BY b.borrowed_date DESC
    """, (legacy_id,))
    
    borrowings = cursor.fetchall()
    print(f"\n📋 Found {len(borrowings)} active borrowings with legacy ID {legacy_id}:")
    
    for borrowing in borrowings:
        print(f"  - Borrowing ID: {borrowing['id']}")
        print(f"    Student: {borrowing['first_name']} {borrowing['last_name']} ({borrowing['admission_number']})")
        print(f"    Book: {borrowing['title']} by {borrowing['author']}")
        print(f"    Borrowed: {borrowing['borrowed_date']}, Due: {borrowing['due_date']}")
        print(f"    Tracking Code: {borrowing['tracking_code']}")
        print(f"    Legacy ID: {borrowing['legacy_book_id']}")
        print()
    
    if not borrowings:
        print(f"❌ No active borrowings found for legacy ID {legacy_id}")
        
        # Check if there are any borrowings (active or not) for this book copy
        cursor = conn.execute("""
            SELECT b.id, b.status, b.borrowed_date, b.returned_date, s.first_name, s.last_name
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE bc.legacy_book_id = ?
            ORDER BY b.borrowed_date DESC
            LIMIT 5
        """, (legacy_id,))
        
        all_borrowings = cursor.fetchall()
        if all_borrowings:
            print(f"📜 Recent borrowings for this book (any status):")
            for b in all_borrowings:
                status_info = f"Status: {b['status']}"
                if b['returned_date']:
                    status_info += f", Returned: {b['returned_date']}"
                print(f"  - {b['first_name']} {b['last_name']}, {status_info}")
    
    conn.close()

def main():
    db_path = find_database()
    if not db_path:
        return
    
    # Test with the legacy ID from the screenshot
    test_legacy_id_search(db_path, 60882)
    
    # Also test with some other legacy IDs from the screenshot
    test_legacy_id_search(db_path, 307)
    test_legacy_id_search(db_path, 70056)

if __name__ == "__main__":
    main()