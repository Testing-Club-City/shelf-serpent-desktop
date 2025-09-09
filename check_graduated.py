#!/usr/bin/env python3
"""
Check specifically for graduated students in local database
Usage: python check_graduated.py
"""

import sqlite3
import os

def check_graduated_students():
    """Check graduated students in local database"""
    
    db_path = os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")
    
    print("🏠 CHECKING GRADUATED STUDENTS IN LOCAL DATABASE")
    print("=" * 60)
    print(f"Database: {db_path}")
    print()
    
    if not os.path.exists(db_path):
        print("❌ Database not found")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check graduated students
        cursor.execute("SELECT COUNT(*) FROM students WHERE class_grade = 'Graduated';")
        graduated_count = cursor.fetchone()[0]
        
        print(f"📊 GRADUATED STUDENTS: {graduated_count}")
        
        if graduated_count > 0:
            cursor.execute("SELECT admission_number, first_name, last_name FROM students WHERE class_grade = 'Graduated' ORDER BY admission_number LIMIT 10;")
            graduated_students = cursor.fetchall()
            
            print("\n📋 SAMPLE GRADUATED STUDENTS:")
            print("-" * 40)
            for student in graduated_students:
                print(f"  {student[0]} - {student[1]} {student[2]}")
        
        # Check all class grades
        cursor.execute("SELECT class_grade, COUNT(*) FROM students GROUP BY class_grade ORDER BY COUNT(*) DESC;")
        all_grades = cursor.fetchall()
        
        print(f"\n📈 ALL CLASS GRADES:")
        print("-" * 30)
        
        total_students = 0
        for grade, count in all_grades:
            total_students += count
            print(f"  {grade}: {count} students")
            
            # Highlight graduated
            if grade == 'Graduated':
                print(f"    ✅ GRADUATED STUDENTS FOUND: {count}")
        
        print(f"\nTOTAL STUDENTS: {total_students}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_graduated_students()
