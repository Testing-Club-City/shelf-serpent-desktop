#!/usr/bin/env python3
"""
Test script to verify group borrowing search using admission numbers
"""

import sqlite3
from pathlib import Path

def get_db_path():
    return Path.home() / "AppData" / "Roaming" / "library-management-system" / "library.db"

def test_admission_grouping():
    """Test group borrowing search using admission numbers"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Testing group borrowing with admission numbers")
        print("=" * 50)
        
        # Test 1: Check if students have admission numbers
        cursor.execute("""
            SELECT id, first_name, last_name, admission_number, class_grade
            FROM students 
            WHERE admission_number IS NOT NULL AND admission_number != ''
            LIMIT 10
        """)
        students = cursor.fetchall()
        
        print("📊 Students with admission numbers:")
        for student in students:
            print(f"  ID: {student[0]}")
            print(f"  Name: {student[1]} {student[2]}")
            print(f"  Admission: {student[3]}")
            print(f"  Class: {student[4]}")
            print("  " + "-" * 30)
        
        # Test 2: Check group borrowings structure
        cursor.execute("""
            SELECT gb.id, gb.book_id, gb.tracking_code, gb.student_count,
                   gb.borrowed_date, gb.status
            FROM group_borrowings gb
            LIMIT 5
        """)
        group_borrowings = cursor.fetchall()
        
        print("\n📋 Group borrowings structure:")
        for gb in group_borrowings:
            print(f"  Group ID: {gb[0]}")
            print(f"  Book ID: {gb[1]}")
            print(f"  Tracking Code: {gb[2]}")
            print(f"  Student Count: {gb[3]}")
            print(f"  Date: {gb[4]}, Status: {gb[5]}")
            print("  " + "-" * 30)
        
        # Test 3: Create a query to group by admission numbers
        cursor.execute("""
            SELECT s.admission_number, s.first_name, s.last_name, s.class_grade,
                   COUNT(*) as borrowing_count
            FROM students s
            WHERE s.admission_number IS NOT NULL
            GROUP BY s.admission_number
            ORDER BY s.class_grade, s.admission_number
            LIMIT 10
        """)
        
        grouped_students = cursor.fetchall()
        
        print("\n🔗 Students grouped by admission numbers:")
        for student in grouped_students:
            print(f"  Admission: {student[0]}")
            print(f"  Name: {student[1]} {student[2]}")
            print(f"  Class: {student[3]}")
            print(f"  Borrowings: {student[4]}")
            print("  " + "-" * 30)
        
        # Test 4: Verify admission number search works
        cursor.execute("""
            SELECT admission_number, first_name, last_name, class_grade
            FROM students
            WHERE admission_number LIKE '%2023%' OR admission_number LIKE '%2024%'
            LIMIT 5
        """)
        
        admission_search = cursor.fetchall()
        
        print("\n🔍 Admission number search results:")
        for student in admission_search:
            print(f"  Admission: {student[0]}")
            print(f"  Name: {student[1]} {student[2]}")
            print(f"  Class: {student[3]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    test_admission_grouping()
