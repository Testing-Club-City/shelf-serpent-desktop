#!/usr/bin/env python3
"""
Analyze the actual Shelf Serpent Desktop database for student status issues
"""

import sqlite3
import os
from pathlib import Path

def analyze_student_status():
    """Analyze student status in the actual database"""
    
    db_path = Path.home() / ".local/share/library-management-system/library.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"🔍 ANALYZING ACTUAL DATABASE")
    print(f"Database: {db_path}")
    print("=" * 80)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check if students table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='students'
        """)
        
        if not cursor.fetchone():
            print("❌ Students table not found")
            return
        
        # Get total student count
        cursor.execute("SELECT COUNT(*) as total FROM students")
        total_students = cursor.fetchone()['total']
        print(f"📊 Total Students: {total_students}")
        
        # Get status distribution
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
        
        graduated_count = 0
        for row in status_distribution:
            status = row['status'] or 'NULL'
            count = row['count']
            percentage = (count / total_students * 100) if total_students > 0 else 0
            print(f"   {status}: {count} students ({percentage:.1f}%)")
            
            if status == 'graduated':
                graduated_count = count
        
        # Show examples of students with 'graduated' status
        if graduated_count > 0:
            print(f"\n⚠️  ISSUE FOUND: {graduated_count} students have 'graduated' status!")
            print("   This is causing the display issue in the Student Management UI!")
            
            cursor.execute("""
                SELECT 
                    admission_number,
                    first_name,
                    last_name,
                    class_grade,
                    status,
                    created_at,
                    updated_at
                FROM students 
                WHERE status = 'graduated'
                ORDER BY updated_at DESC
                LIMIT 10
            """)
            
            examples = cursor.fetchall()
            print(f"\n   Examples (showing 10 of {graduated_count}):")
            for student in examples:
                print(f"   - {student['admission_number']}: {student['first_name']} {student['last_name']}")
                print(f"     Class: {student['class_grade']}, Updated: {student['updated_at']}")
        
        # Check class status
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='classes'
        """)
        
        if cursor.fetchone():
            cursor.execute("""
                SELECT 
                    is_active,
                    COUNT(*) as count
                FROM classes 
                GROUP BY is_active
            """)
            
            class_status = cursor.fetchall()
            print(f"\n🏫 Class Status Distribution:")
            
            for row in class_status:
                is_active = row['is_active']
                count = row['count']
                status_text = "Active" if is_active else "Graduated"
                print(f"   {status_text}: {count} classes")
        
        # Check for data inconsistencies
        cursor.execute("""
            SELECT 
                s.admission_number,
                s.first_name,
                s.last_name,
                s.class_grade,
                s.status as student_status,
                c.class_name,
                c.is_active as class_is_active
            FROM students s
            LEFT JOIN classes c ON s.class_grade = c.class_name
            WHERE s.status = 'graduated'
            LIMIT 5
        """)
        
        inconsistent_students = cursor.fetchall()
        if inconsistent_students:
            print(f"\n🔍 Students with 'graduated' status and their classes:")
            for student in inconsistent_students:
                class_status = "Active" if student['class_is_active'] else "Graduated"
                print(f"   - {student['admission_number']}: {student['first_name']} {student['last_name']}")
                print(f"     Student Status: {student['student_status']}")
                print(f"     Class: {student['class_name']} ({class_status})")
                print()
        
        conn.close()
        
        # Generate fix commands
        if graduated_count > 0:
            print("\n💡 SOLUTION TO FIX THE ISSUE:")
            print("=" * 50)
            print("The issue is that students have 'graduated' status, but the UI expects 'active' or 'inactive'.")
            print("According to the implementation documentation, graduated students should have 'inactive' status.")
            print("\n🔧 Run this SQL command to fix the issue:")
            print("UPDATE students SET status = 'inactive' WHERE status = 'graduated';")
            print(f"\nThis will fix {graduated_count} student records and resolve the display issue.")
            
            print("\n📝 To apply this fix:")
            print("1. Open the database with a SQLite client")
            print("2. Run the UPDATE command above")
            print("3. Restart the Shelf Serpent Desktop application")
            print("4. The students should now show as 'Inactive' instead of 'Graduated'")
        else:
            print("\n✅ No issues found with student status!")
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    analyze_student_status()
