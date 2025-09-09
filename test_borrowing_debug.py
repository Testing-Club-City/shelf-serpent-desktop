#!/usr/bin/env python3

import sqlite3
import json
from datetime import datetime, timedelta
import uuid

def test_borrowing_insertion():
    """Test borrowing insertion directly in SQLite to debug the issue"""
    
    # Connect to the database
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Connected to database successfully")
        
        # Check if we have students and books
        cursor.execute("SELECT COUNT(*) FROM students")
        student_count = cursor.fetchone()[0]
        print(f"Students in database: {student_count}")
        
        cursor.execute("SELECT COUNT(*) FROM books")
        book_count = cursor.fetchone()[0]
        print(f"Books in database: {book_count}")
        
        if student_count == 0 or book_count == 0:
            print("Need students and books to test borrowing")
            return
            
        # Get a sample student and book
        cursor.execute("SELECT id FROM students LIMIT 1")
        student_id = cursor.fetchone()[0]
        print(f"Using student ID: {student_id}")
        
        cursor.execute("SELECT id FROM books LIMIT 1")
        book_id = cursor.fetchone()[0]
        print(f"Using book ID: {book_id}")
        
        # Create a test borrowing
        borrowing_id = str(uuid.uuid4())
        borrowed_date = datetime.now().strftime('%Y-%m-%d')
        due_date = (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
        created_at = datetime.now().isoformat()
        
        borrowing_data = {
            'id': borrowing_id,
            'student_id': student_id,
            'book_id': book_id,
            'borrowed_date': borrowed_date,
            'due_date': due_date,
            'returned_date': None,
            'status': 'active',
            'fine_amount': 0.0,
            'notes': 'Test borrowing from Python',
            'issued_by': None,
            'returned_by': None,
            'created_at': created_at,
            'updated_at': created_at,
            'fine_paid': 0,  # SQLite expects 0/1 for boolean
            'book_copy_id': None,
            'condition_at_issue': 'good',
            'condition_at_return': None,
            'is_lost': 0,  # SQLite expects 0/1 for boolean
            'tracking_code': None,
            'return_notes': None,
            'copy_condition': None,
            'group_borrowing_id': None,
            'borrower_type': 'student',
            'staff_id': None
        }
        
        print("Attempting to insert borrowing...")
        print(f"Borrowing data: {json.dumps(borrowing_data, indent=2)}")
        
        # Try to insert the borrowing
        insert_sql = """
        INSERT INTO borrowings (
            id, student_id, book_id, borrowed_date, due_date, returned_date, 
            status, fine_amount, notes, issued_by, returned_by, created_at, 
            updated_at, fine_paid, book_copy_id, condition_at_issue, 
            condition_at_return, is_lost, tracking_code, return_notes, 
            copy_condition, group_borrowing_id, borrower_type, staff_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        cursor.execute(insert_sql, (
            borrowing_data['id'],
            borrowing_data['student_id'],
            borrowing_data['book_id'],
            borrowing_data['borrowed_date'],
            borrowing_data['due_date'],
            borrowing_data['returned_date'],
            borrowing_data['status'],
            borrowing_data['fine_amount'],
            borrowing_data['notes'],
            borrowing_data['issued_by'],
            borrowing_data['returned_by'],
            borrowing_data['created_at'],
            borrowing_data['updated_at'],
            borrowing_data['fine_paid'],
            borrowing_data['book_copy_id'],
            borrowing_data['condition_at_issue'],
            borrowing_data['condition_at_return'],
            borrowing_data['is_lost'],
            borrowing_data['tracking_code'],
            borrowing_data['return_notes'],
            borrowing_data['copy_condition'],
            borrowing_data['group_borrowing_id'],
            borrowing_data['borrower_type'],
            borrowing_data['staff_id']
        ))
        
        conn.commit()
        print("✅ Borrowing inserted successfully!")
        
        # Verify the insertion
        cursor.execute("SELECT * FROM borrowings WHERE id = ?", (borrowing_id,))
        result = cursor.fetchone()
        if result:
            print("✅ Borrowing verified in database")
            print(f"Inserted borrowing: {result}")
        else:
            print("❌ Borrowing not found after insertion")
            
    except sqlite3.Error as e:
        print(f"❌ SQLite error: {e}")
    except Exception as e:
        print(f"❌ General error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    test_borrowing_insertion()
