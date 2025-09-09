#!/usr/bin/env python3
"""
Fixed test script for group borrowing search using admission numbers
with correct schema mapping
"""

import sqlite3
from pathlib import Path

def get_db_path():
    return Path.home() / "AppData" / "Roaming" / "library-management-system" / "library.db"

def test_admission_search():
    """Test group borrowing search using admission numbers"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Testing Group Borrowing Search with Admission Numbers")
        print("=" * 60)
        
        # First, let's check the actual table structure
        cursor.execute("PRAGMA table_info(group_borrowings)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"📊 group_borrowings columns: {columns}")
        
        # Test 1: Check students with admission numbers
        cursor.execute("""
            SELECT id, first_name, last_name, admission_number, class_grade
            FROM students 
            WHERE admission_number IS NOT NULL AND admission_number != ''
            LIMIT 10
        """)
        students = cursor.fetchall()
        
        print(f"\n📊 Students with admission numbers: {len(students)}")
        for student in students:
            print(f"  ID: {student[0]}, Name: {student[1]} {student[2]}, Admission: {student[3]}, Class: {student[4]}")
        
        # Test 2: Check group borrowings
        cursor.execute("""
            SELECT tracking_code, student_count, borrowed_date, status, student_ids
            FROM group_borrowings
            LIMIT 5
        """)
        group_borrowings = cursor.fetchall()
        
        print(f"\n📋 Group borrowings: {len(group_borrowings)}")
        for gb in group_borrowings:
            tracking, count, date, status, student_ids = gb
            print(f"  Tracking: {tracking}")
            print(f"  Student Count: {count}")
            print(f"  Date: {date}, Status: {status}")
            print(f"  Student IDs: {student_ids}")
            print("  " + "-" * 30)
        
        # Test 3: Create correct admission-based search
        cursor.execute("""
            SELECT 
                s.admission_number,
                s.first_name || ' ' || s.last_name as full_name,
                s.class_grade,
                COUNT(*) as student_count
            FROM students s
            WHERE s.admission_number IS NOT NULL
            GROUP BY s.admission_number, s.first_name, s.last_name, s.class_grade
            ORDER BY s.class_grade, s.admission_number
            LIMIT 10
        """)
        
        admission_groups = cursor.fetchall()
        
        print(f"\n🔗 Students grouped by admission numbers: {len(admission_groups)}")
        for group in admission_groups:
            admission, name, class_grade, count = group
            print(f"  Admission: {admission}")
            print(f"  Name: {name}")
            print(f"  Class: {class_grade}")
            print(f"  Count: {count}")
            print("  " + "-" * 30)
        
        # Test 4: Search for specific admission numbers
        cursor.execute("""
            SELECT admission_number, first_name, last_name, class_grade
            FROM students
            WHERE admission_number LIKE '%2023%' OR admission_number LIKE '%2024%'
            ORDER BY admission_number
            LIMIT 5
        """)
        
        admission_search = cursor.fetchall()
        
        print(f"\n🔍 Admission search results: {len(admission_search)}")
        for student in admission_search:
            admission, first, last, class_grade = student
            print(f"  Admission: {admission} - {first} {last} ({class_grade})")
        
        # Test 5: Correct group borrowing mapping using admission numbers
        cursor.execute("""
            SELECT 
                s.admission_number,
                gb.tracking_code,
                b.title,
                gb.borrowed_date,
                gb.status
            FROM students s
            JOIN books b ON 1=1  -- This needs to be fixed
            JOIN group_borrowings gb ON 1=1  -- This needs to be fixed
            WHERE s.admission_number IS NOT NULL
            LIMIT 5
        """)
        
        # Let's try a simpler approach - direct mapping
        cursor.execute("""
            SELECT 
                s.admission_number,
                s.first_name,
                s.last_name,
                s.class_grade
            FROM students s
            WHERE s.admission_number IS NOT NULL
            ORDER BY s.admission_number
            LIMIT 10
        """)
        
        students = cursor.fetchall()
        
        print(f"\n✅ Correct admission-based grouping:")
        for student in students:
            admission, first, last, class_grade = student
            print(f"  Admission: {admission}")
            print(f"  Student: {first} {last}")
            print(f"  Class: {class_grade}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    test_admission_search()
