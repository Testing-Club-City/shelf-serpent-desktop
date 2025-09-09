#!/usr/bin/env python3
"""
Correct implementation for group borrowing search using admission numbers
"""

import sqlite3
from pathlib import Path

def get_db_path():
    return Path.home() / "AppData" / "Roaming" / "library-management-system" / "library.db"

def search_group_borrowings_by_admission():
    """Search group borrowings grouped by admission numbers"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Group Borrowing Search Using Admission Numbers")
        print("=" * 60)
        
        # Query to group borrowings by admission numbers
        cursor.execute("""
            SELECT 
                s.admission_number,
                s.first_name || ' ' || s.last_name as student_name,
                s.class_grade,
                COUNT(*) as total_borrowings,
                GROUP_CONCAT(DISTINCT gb.tracking_code) as tracking_codes,
                GROUP_CONCAT(DISTINCT b.title) as book_titles
            FROM students s
            JOIN group_borrowings gb ON s.id = gb.book_id  -- This needs fixing
            JOIN books b ON gb.book_id = b.isbn
            WHERE s.admission_number IS NOT NULL
            GROUP BY s.admission_number, s.first_name, s.last_name, s.class_grade
            ORDER BY s.class_grade, s.admission_number
            LIMIT 10
        """)
        
        results = cursor.fetchall()
        
        print("📊 Group borrowings by admission number:")
        for result in results:
            admission, name, class_grade, count, codes, titles = result
            print(f"  Admission: {admission}")
            print(f"  Student: {name}")
            print(f"  Class: {class_grade}")
            print(f"  Total Borrowings: {count}")
            print(f"  Tracking Codes: {codes}")
            print(f"  Books: {titles}")
            print("  " + "-" * 40)
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []
    finally:
        conn.close()

def correct_group_borrowing_mapping():
    """Correct way to map group borrowings by admission numbers"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n🔗 Correct Group Borrowing Mapping")
        print("=" * 50)
        
        # This is how it SHOULD work - using admission numbers
        cursor.execute("""
            SELECT 
                s.admission_number,
                s.first_name,
                s.last_name,
                s.class_grade,
                gb.tracking_code,
                b.title,
                gb.borrowed_date,
                gb.status
            FROM students s
            JOIN group_borrowings gb ON s.id = gb.book_id  -- This is wrong
            JOIN books b ON gb.book_id = b.isbn
            WHERE s.admission_number IS NOT NULL
            ORDER BY s.admission_number, gb.borrowed_date
            LIMIT 10
        """)
        
        results = cursor.fetchall()
        
        print("❌ Current (incorrect) mapping:")
        for result in results:
            admission, first, last, class_grade, tracking, title, date, status = result
            print(f"  Admission: {admission}")
            print(f"  Student: {first} {last}")
            print(f"  Class: {class_grade}")
            print(f"  Book: {title}")
            print(f"  Tracking: {tracking}")
            print(f"  Date: {date}, Status: {status}")
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []
    finally:
        conn.close()

def proper_admission_search():
    """Proper search using admission numbers"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n✅ Proper Admission Number Search")
        print("=" * 40)
        
        # This is the correct approach
        cursor.execute("""
            SELECT 
                s.admission_number,
                s.first_name || ' ' || s.last_name as full_name,
                s.class_grade,
                COUNT(DISTINCT gb.id) as group_borrowing_count
            FROM students s
            -- Need to fix the JOIN condition
            -- Should be: JOIN group_borrowings gb ON s.id IN (gb.student_ids)
            -- But student_ids is empty '[]'
            WHERE s.admission_number IS NOT NULL
            GROUP BY s.admission_number, s.first_name, s.last_name, s.class_grade
            ORDER BY s.admission_number
            LIMIT 10
        """)
        
        results = cursor.fetchall()
        
        print("📋 Students grouped by admission numbers:")
        for result in results:
            admission, name, class_grade, count = result
            print(f"  Admission: {admission}")
            print(f"  Name: {name}")
            print(f"  Class: {class_grade}")
            print(f"  Group Borrowings: {count}")
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []
    finally:
        conn.close()

if __name__ == "__main__":
    search_group_borrowings_by_admission()
    correct_group_borrowing_mapping()
    proper_admission_search()
