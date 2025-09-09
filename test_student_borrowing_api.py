#!/usr/bin/env python3

import sqlite3
import json

DB_PATH = "/home/deniskariuki/.local/share/library-management-system/library.db"

def test_student_borrowing_response():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Test the exact query from get_borrowings_with_details for students
    query = """
        SELECT 
            b.id, b.student_id, b.book_id, b.borrowed_date, b.due_date, b.returned_date,
            b.status, b.fine_amount, b.notes, b.tracking_code, b.borrower_type, b.staff_id,
            b.condition_at_return,
            s.first_name as student_first_name, s.last_name as student_last_name, 
            s.admission_number, s.class_grade,
            st.first_name as staff_first_name, st.last_name as staff_last_name,
            st.staff_id as staff_identifier, st.department as staff_department,
            st.position as staff_position, st.email as staff_email,
            COALESCE(bk.title, bc.title, 'Unknown Book') as book_title, 
            COALESCE(bk.author, bc.author, 'Unknown Author') as book_author, 
            COALESCE(bk.isbn, bc.isbn) as book_isbn,
            bc.copy_identifier as copy_number,
            bc.legacy_book_id
        FROM borrowings b
        LEFT JOIN students s ON b.student_id = s.id AND s.deleted = 0
        LEFT JOIN staff st ON b.staff_id = st.id AND st.deleted = 0
        LEFT JOIN books bk ON b.book_id = bk.id AND bk.deleted = 0
        LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND bc.deleted = 0
        WHERE b.deleted = 0 AND b.borrower_type = 'student'
        ORDER BY b.created_at DESC
        LIMIT 3
    """
    
    cursor = conn.execute(query)
    rows = cursor.fetchall()
    
    print("Sample student borrowing API responses:")
    print("=" * 50)
    
    for row in rows:
        # Simulate the JSON response structure
        response = {
            "id": row["id"],
            "borrower_type": row["borrower_type"],
            "status": row["status"],
            "students": {
                "first_name": row["student_first_name"],
                "last_name": row["student_last_name"],
                "admission_number": row["admission_number"]
            } if row["student_first_name"] else None,
            "book_copies": {
                "copy_identifier": row["copy_number"],
                "legacy_book_id": row["legacy_book_id"]
            } if row["copy_number"] or row["legacy_book_id"] else None,
            "books": {
                "title": row["book_title"],
                "author": row["book_author"]
            }
        }
        
        print(f"Borrowing ID: {row['id']}")
        print(f"Student: {row['student_first_name']} {row['student_last_name']} ({row['admission_number']})")
        print(f"Legacy Book ID: {row['legacy_book_id']}")
        print(f"Book Title: {row['book_title']}")
        print(f"JSON Response:")
        print(json.dumps(response, indent=2))
        print("-" * 30)
    
    conn.close()

if __name__ == "__main__":
    test_student_borrowing_response()
