#!/usr/bin/env python3
"""
Check specific database files for student status issues
"""

import sqlite3
import os
from pathlib import Path

def analyze_database(db_path):
    """Analyze a specific database file"""
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return
    
    print(f"\n🔍 ANALYZING DATABASE: {db_path}")
    print("=" * 80)
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check if students table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='students'
        """)
        
        if not cursor.fetchone():
            print("❌ Students table not found")
            
            # Show all tables
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table'
                ORDER BY name
            """)
            tables = cursor.fetchall()
            print(f"📋 Available tables ({len(tables)}):")
            for table in tables:
                print(f"   - {table['name']}")
            return
        
        # Get student count and status distribution
        cursor.execute("SELECT COUNT(*) as total FROM students")
        total_students = cursor.fetchone()['total']
        
        cursor.execute("""
            SELECT 
                status,
                COUNT(*) as count
            FROM students 
            GROUP BY status
            ORDER BY count DESC
        """)
        
        status_distribution = cursor.fetchall()
        print(f"📊 Total Students: {total_students}")
        print("📊 Status Distribution:")
        
        for row in status_distribution:
            status = row['status'] or 'NULL'
            count = row['count']
            percentage = (count / total_students * 100) if total_students > 0 else 0
            print(f"   {status}: {count} students ({percentage:.1f}%)")
        
        # Check for 'graduated' status specifically
        cursor.execute("""
            SELECT COUNT(*) as count FROM students WHERE status = 'graduated'
        """)
        graduated_count = cursor.fetchone()['count']
        
        if graduated_count > 0:
            print(f"\n⚠️  ISSUE FOUND: {graduated_count} students have 'graduated' status")
            print("   This is causing the display issue in the UI!")
            
            # Show some examples
            cursor.execute("""
                SELECT 
                    admission_number,
                    first_name,
                    last_name,
                    class_grade,
                    status
                FROM students 
                WHERE status = 'graduated'
                LIMIT 5
            """)
            
            examples = cursor.fetchall()
            print(f"\n   Examples (showing 5 of {graduated_count}):")
            for student in examples:
                print(f"   - {student['admission_number']}: {student['first_name']} {student['last_name']} (Class: {student['class_grade']})")
        
        # Check classes table if it exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='classes'
        """)
        
        if cursor.fetchone():
            cursor.execute("SELECT COUNT(*) as total FROM classes")
            total_classes = cursor.fetchone()['total']
            
            cursor.execute("""
                SELECT 
                    is_active,
                    COUNT(*) as count
                FROM classes 
                GROUP BY is_active
            """)
            
            class_status = cursor.fetchall()
            print(f"\n🏫 Total Classes: {total_classes}")
            print("🏫 Class Status:")
            
            for row in class_status:
                is_active = row['is_active']
                count = row['count']
                status_text = "Active" if is_active else "Graduated"
                print(f"   {status_text}: {count} classes")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def main():
    print("🚀 Shelf Serpent Desktop - Database Analysis")
    
    # Check multiple potential database locations
    databases_to_check = [
        "/home/deniskariuki/.wine/drive_c/users/deniskariuki/AppData/Roaming/shelf-serpent/library.db",
        "/home/deniskariuki/shelf-serpent-desktop/library.db",
        "/home/deniskariuki/shelf-serpent-desktop/shelf-serpent.db",
        "/home/deniskariuki/.local/share/shelf-serpent-desktop/library.db",
    ]
    
    for db_path in databases_to_check:
        analyze_database(db_path)
    
    print("\n💡 SOLUTION:")
    print("=" * 50)
    print("If you found students with 'graduated' status, run this SQL command:")
    print("UPDATE students SET status = 'inactive' WHERE status = 'graduated';")
    print("\nThis will fix the display issue in the Student Management interface.")

if __name__ == "__main__":
    main()
