#!/usr/bin/env python3
"""
Debug script to check student status issues in the Shelf Serpent Desktop database
"""

import sqlite3
import json
from datetime import datetime

def check_student_status():
    """Check student status in the local SQLite database"""
    
    # Connect to the local SQLite database
    db_path = "/home/deniskariuki/shelf-serpent-desktop/shelf-serpent.db"
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # This enables column access by name
        cursor = conn.cursor()
        
        print("🔍 STUDENT STATUS ANALYSIS")
        print("=" * 50)
        
        # 1. Check total students and their status distribution
        cursor.execute("""
            SELECT 
                status,
                COUNT(*) as count
            FROM students 
            GROUP BY status
            ORDER BY count DESC
        """)
        
        status_distribution = cursor.fetchall()
        print("\n📊 Student Status Distribution:")
        for row in status_distribution:
            status = row['status'] or 'NULL'
            count = row['count']
            print(f"   {status}: {count} students")
        
        # 2. Check students with 'graduated' status specifically
        cursor.execute("""
            SELECT 
                id,
                admission_number,
                first_name,
                last_name,
                class_grade,
                status,
                created_at,
                updated_at
            FROM students 
            WHERE status = 'graduated'
            LIMIT 10
        """)
        
        graduated_students = cursor.fetchall()
        if graduated_students:
            print(f"\n🎓 Students with 'graduated' status (showing first 10):")
            for student in graduated_students:
                print(f"   {student['admission_number']}: {student['first_name']} {student['last_name']} - Class: {student['class_grade']}")
        else:
            print("\n✅ No students found with 'graduated' status")
        
        # 3. Check students with NULL or empty status
        cursor.execute("""
            SELECT 
                id,
                admission_number,
                first_name,
                last_name,
                class_grade,
                status,
                created_at,
                updated_at
            FROM students 
            WHERE status IS NULL OR status = ''
            LIMIT 10
        """)
        
        null_status_students = cursor.fetchall()
        if null_status_students:
            print(f"\n⚠️  Students with NULL/empty status (showing first 10):")
            for student in null_status_students:
                status_display = student['status'] if student['status'] else 'NULL'
                print(f"   {student['admission_number']}: {student['first_name']} {student['last_name']} - Status: {status_display}")
        else:
            print("\n✅ No students found with NULL/empty status")
        
        # 4. Check class graduation status
        cursor.execute("""
            SELECT 
                id,
                class_name,
                form_level,
                is_active,
                created_at,
                updated_at
            FROM classes 
            ORDER BY form_level, class_name
        """)
        
        classes = cursor.fetchall()
        print(f"\n🏫 Class Status (Total: {len(classes)}):")
        active_classes = 0
        inactive_classes = 0
        
        for cls in classes:
            is_active = cls['is_active']
            status_text = "Active" if is_active else "Graduated"
            print(f"   {cls['class_name']} (Form {cls['form_level']}): {status_text}")
            
            if is_active:
                active_classes += 1
            else:
                inactive_classes += 1
        
        print(f"\n   Summary: {active_classes} active, {inactive_classes} graduated classes")
        
        # 5. Check students in graduated classes
        cursor.execute("""
            SELECT 
                s.id,
                s.admission_number,
                s.first_name,
                s.last_name,
                s.class_grade,
                s.status as student_status,
                c.class_name,
                c.is_active as class_is_active
            FROM students s
            LEFT JOIN classes c ON s.class_grade = c.class_name
            WHERE c.is_active = 0
            LIMIT 10
        """)
        
        students_in_graduated_classes = cursor.fetchall()
        if students_in_graduated_classes:
            print(f"\n🎓 Students in graduated classes (showing first 10):")
            for student in students_in_graduated_classes:
                print(f"   {student['admission_number']}: {student['first_name']} {student['last_name']}")
                print(f"      Class: {student['class_name']} (Graduated)")
                print(f"      Student Status: {student['student_status']}")
                print()
        else:
            print("\n✅ No students found in graduated classes")
        
        # 6. Check for data inconsistencies
        cursor.execute("""
            SELECT 
                s.id,
                s.admission_number,
                s.first_name,
                s.last_name,
                s.class_grade,
                s.status as student_status,
                c.class_name,
                c.is_active as class_is_active
            FROM students s
            LEFT JOIN classes c ON s.class_grade = c.class_name
            WHERE (s.status = 'active' AND c.is_active = 0) 
               OR (s.status = 'inactive' AND c.is_active = 1)
            LIMIT 10
        """)
        
        inconsistent_data = cursor.fetchall()
        if inconsistent_data:
            print(f"\n⚠️  Data Inconsistencies Found (showing first 10):")
            for student in inconsistent_data:
                print(f"   {student['admission_number']}: {student['first_name']} {student['last_name']}")
                print(f"      Student Status: {student['student_status']}")
                print(f"      Class: {student['class_name']} ({'Active' if student['class_is_active'] else 'Graduated'})")
                print(f"      Issue: Student status doesn't match class status")
                print()
        else:
            print("\n✅ No data inconsistencies found between student and class status")
        
        # 7. Generate recommendations
        print("\n💡 RECOMMENDATIONS:")
        print("=" * 50)
        
        if graduated_students:
            print("1. 🔧 Fix students with 'graduated' status:")
            print("   - Students should have 'active' or 'inactive' status, not 'graduated'")
            print("   - Run: UPDATE students SET status = 'inactive' WHERE status = 'graduated';")
        
        if null_status_students:
            print("2. 🔧 Fix students with NULL/empty status:")
            print("   - Set default status to 'active' for students with NULL status")
            print("   - Run: UPDATE students SET status = 'active' WHERE status IS NULL OR status = '';")
        
        if inconsistent_data:
            print("3. 🔧 Fix data inconsistencies:")
            print("   - Align student status with class graduation status")
            print("   - Students in graduated classes should be 'inactive'")
            print("   - Students in active classes should be 'active'")
        
        print("\n4. 🔧 Recommended SQL fixes:")
        print("""
        -- Fix graduated status to inactive
        UPDATE students SET status = 'inactive' WHERE status = 'graduated';
        
        -- Fix NULL/empty status to active
        UPDATE students SET status = 'active' WHERE status IS NULL OR status = '';
        
        -- Align student status with class status
        UPDATE students 
        SET status = 'inactive' 
        WHERE class_grade IN (
            SELECT class_name FROM classes WHERE is_active = 0
        ) AND status = 'active';
        
        UPDATE students 
        SET status = 'active' 
        WHERE class_grade IN (
            SELECT class_name FROM classes WHERE is_active = 1
        ) AND status = 'inactive';
        """)
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_student_status()
