#!/usr/bin/env python3
"""
Quick verification script for admission number setup in group borrowing
"""

import sqlite3
import json
import os

def check_database_setup():
    """Check database setup for admission-based group borrowing"""
    
    # Check for database files
    db_files = ['shelf-serpent.db', 'library.db']
    db_file = None
    
    for db in db_files:
        if os.path.exists(db):
            db_file = db
            break
    
    if not db_file:
        print("❌ No database file found")
        return False
    
    print(f"✅ Found database: {db_file}")
    
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Check available tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"📊 Available tables: {len(tables)}")
    for table in sorted(tables):
        print(f"   - {table}")
    
    # Check students table
    if 'students' in tables:
        cursor.execute("SELECT COUNT(*) FROM students")
        student_count = cursor.fetchone()[0]
        print(f"👥 Students: {student_count}")
        
        if student_count > 0:
            cursor.execute("SELECT admission_number FROM students WHERE admission_number IS NOT NULL LIMIT 5")
            admissions = cursor.fetchall()
            print("📋 Sample admission numbers:")
            for admission in admissions:
                print(f"   - {admission[0]}")
    
    # Check group_borrowings table
    if 'group_borrowings' in tables:
        cursor.execute("SELECT COUNT(*) FROM group_borrowings")
        group_count = cursor.fetchone()[0]
        print(f"📚 Group borrowings: {group_count}")
        
        # Check structure
        cursor.execute("PRAGMA table_info(group_borrowings)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"📋 Group borrowings columns: {columns}")
        
        if 'student_admissions' in columns:
            print("✅ Using admission numbers in group_borrowings")
        else:
            print("⚠️  student_admissions column not found")
    
    # Check book_copies table
    if 'book_copies' in tables:
        cursor.execute("SELECT COUNT(*) FROM book_copies WHERE status = 'available'")
        available_books = cursor.fetchone()[0]
        print(f"📖 Available book copies: {available_books}")
    
    conn.close()
    return True

def verify_admission_grouping():
    """Verify admission numbers can be used for grouping"""
    
    db_files = ['shelf-serpent.db', 'library.db']
    db_file = None
    
    for db in db_files:
        if os.path.exists(db):
            db_file = db
            break
    
    if not db_file:
        return False
    
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    try:
        # Test admission number grouping
        cursor.execute("""
            SELECT admission_number, COUNT(*) as count
            FROM students 
            WHERE status = 'active' AND admission_number IS NOT NULL
            GROUP BY admission_number
            ORDER BY count DESC
            LIMIT 5
        """)
        
        groups = cursor.fetchall()
        print(f"\n🔍 Admission number grouping:")
        for admission, count in groups:
            print(f"   - {admission}: {count} students")
        
        return len(groups) > 0
        
    except Exception as e:
        print(f"❌ Error checking admission grouping: {e}")
        return False
    
    finally:
        conn.close()

if __name__ == "__main__":
    print("🔍 Verifying Admission Number Setup for Group Borrowing")
    print("=" * 50)
    
    if check_database_setup():
        verify_admission_grouping()
        print("\n✅ Database verification complete")
    else:
        print("\n❌ Database verification failed")
