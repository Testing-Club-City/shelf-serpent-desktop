#!/usr/bin/env python3
"""
Debug script to check student status issues in the Shelf Serpent Desktop database
Looks for the database in typical Tauri app data locations
"""

import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime

def find_app_database():
    """Find the Shelf Serpent Desktop database in app data folders"""
    
    # Common Tauri app data locations on Linux
    possible_paths = [
        # Linux XDG data directory
        Path.home() / ".local" / "share" / "shelf-serpent-desktop" / "shelf-serpent.db",
        Path.home() / ".local" / "share" / "shelf-serpent-desktop" / "library.db",
        Path.home() / ".local" / "share" / "com.shelf-serpent.desktop" / "shelf-serpent.db",
        Path.home() / ".local" / "share" / "com.shelf-serpent.desktop" / "library.db",
        
        # Alternative locations
        Path.home() / ".config" / "shelf-serpent-desktop" / "shelf-serpent.db",
        Path.home() / ".config" / "shelf-serpent-desktop" / "library.db",
        
        # Check current directory as fallback
        Path("./shelf-serpent.db"),
        Path("./library.db"),
        
        # Check if there's a database in src-tauri
        Path("./src-tauri/shelf-serpent.db"),
        Path("./src-tauri/library.db"),
    ]
    
    print("🔍 Searching for Shelf Serpent Desktop database...")
    
    for path in possible_paths:
        if path.exists():
            print(f"✅ Found database at: {path}")
            return str(path)
        else:
            print(f"❌ Not found: {path}")
    
    # Try to find any .db files in common app data locations
    search_dirs = [
        Path.home() / ".local" / "share",
        Path.home() / ".config",
        Path(".")
    ]
    
    print("\n🔍 Searching for any .db files in app data directories...")
    for search_dir in search_dirs:
        if search_dir.exists():
            for db_file in search_dir.rglob("*.db"):
                if "shelf" in str(db_file).lower() or "library" in str(db_file).lower():
                    print(f"📁 Found potential database: {db_file}")
                    return str(db_file)
    
    return None

def check_student_status(db_path):
    """Check student status in the SQLite database"""
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # This enables column access by name
        cursor = conn.cursor()
        
        print(f"\n🔍 STUDENT STATUS ANALYSIS")
        print(f"Database: {db_path}")
        print("=" * 70)
        
        # First, check if students table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='students'
        """)
        
        if not cursor.fetchone():
            print("❌ Students table not found in database")
            
            # Show all tables
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table'
                ORDER BY name
            """)
            tables = cursor.fetchall()
            print(f"\n📋 Available tables ({len(tables)}):")
            for table in tables:
                print(f"   - {table['name']}")
            return
        
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
        total_students = sum(row['count'] for row in status_distribution)
        
        for row in status_distribution:
            status = row['status'] or 'NULL'
            count = row['count']
            percentage = (count / total_students * 100) if total_students > 0 else 0
            print(f"   {status}: {count} students ({percentage:.1f}%)")
        
        print(f"\n   Total Students: {total_students}")
        
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
            print(f"\n🎓 Students with 'graduated' status (showing first 10 of {len(graduated_students)}):")
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
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='classes'
        """)
        
        if cursor.fetchone():
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
        else:
            print("\n⚠️  Classes table not found - cannot check class-student relationships")
        
        # 7. Sample some students to see their actual data
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
            ORDER BY created_at DESC
            LIMIT 5
        """)
        
        sample_students = cursor.fetchall()
        if sample_students:
            print(f"\n📋 Sample Students (most recent 5):")
            for student in sample_students:
                print(f"   {student['admission_number']}: {student['first_name']} {student['last_name']}")
                print(f"      Class: {student['class_grade']}")
                print(f"      Status: {student['status']}")
                print(f"      Created: {student['created_at']}")
                print()
        
        # 8. Generate recommendations
        print("\n💡 RECOMMENDATIONS:")
        print("=" * 50)
        
        if graduated_students:
            print("1. 🔧 Fix students with 'graduated' status:")
            print("   - Students should have 'active' or 'inactive' status, not 'graduated'")
            print("   - The UI expects 'active' or 'inactive' status values")
            print(f"   - Found {len(graduated_students)} students with 'graduated' status")
        
        if null_status_students:
            print("2. 🔧 Fix students with NULL/empty status:")
            print("   - Set default status to 'active' for students with NULL status")
            print(f"   - Found {len(null_status_students)} students with NULL/empty status")
        
        print("\n3. 🔧 SQL Commands to fix the issues:")
        print("   Copy and run these in your database:")
        print("""
   -- Fix 'graduated' status to 'inactive' (graduated students should be inactive)
   UPDATE students SET status = 'inactive' WHERE status = 'graduated';
   
   -- Fix NULL/empty status to 'active' (default for new students)
   UPDATE students SET status = 'active' WHERE status IS NULL OR status = '';
   
   -- Verify the changes
   SELECT status, COUNT(*) FROM students GROUP BY status;
        """)
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        if conn:
            conn.close()

def main():
    print("🚀 Shelf Serpent Desktop - Student Status Debugger")
    print("=" * 60)
    
    db_path = find_app_database()
    
    if not db_path:
        print("\n❌ Could not find the Shelf Serpent Desktop database!")
        print("\n💡 Possible solutions:")
        print("1. Make sure the app has been run at least once to create the database")
        print("2. Check if the database is in a different location")
        print("3. Try running the app first to initialize the database")
        return
    
    check_student_status(db_path)

if __name__ == "__main__":
    main()
