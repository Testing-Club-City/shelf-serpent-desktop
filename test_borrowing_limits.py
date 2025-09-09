#!/usr/bin/env python3

import sqlite3
import json

def check_borrowing_limits():
    """Check if borrowing limits are properly synced from Supabase"""
    
    # Connect to the database
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Checking borrowing limits in local database...")
        
        # Check classes table structure
        cursor.execute("PRAGMA table_info(classes)")
        columns = cursor.fetchall()
        print("\n📋 Classes table structure:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Check if max_books_allowed column exists
        has_max_books = any(col[1] == 'max_books_allowed' for col in columns)
        print(f"\n✅ max_books_allowed column exists: {has_max_books}")
        
        # Get all classes with their borrowing limits
        cursor.execute("""
            SELECT id, class_name, form_level, max_books_allowed, is_active 
            FROM classes 
            ORDER BY form_level, class_name
        """)
        classes = cursor.fetchall()
        
        print(f"\n📚 Found {len(classes)} classes:")
        print("=" * 80)
        print(f"{'Class Name':<25} {'Form':<6} {'Max Books':<10} {'Active':<8}")
        print("=" * 80)
        
        for class_data in classes:
            class_id, class_name, form_level, max_books, is_active = class_data
            active_status = "Yes" if is_active else "No"
            print(f"{class_name:<25} {form_level:<6} {max_books:<10} {active_status:<8}")
        
        # Check if all classes have default limit (2) - indicates sync issue
        default_count = sum(1 for c in classes if c[3] == 2)  # max_books_allowed = 2
        
        if default_count == len(classes) and len(classes) > 0:
            print(f"\n⚠️  WARNING: All {len(classes)} classes have default limit (2)")
            print("   This suggests borrowing limits are NOT being synced from Supabase!")
        else:
            print(f"\n✅ Borrowing limits appear to be properly synced")
            print(f"   {len(classes) - default_count} classes have custom limits")
        
        # Check for students and their class assignments
        cursor.execute("""
            SELECT s.admission_number, s.first_name, s.last_name, c.class_name, c.max_books_allowed,
                   COUNT(b.id) as active_borrowings
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN borrowings b ON s.id = b.student_id AND b.status = 'active'
            GROUP BY s.id
            LIMIT 10
        """)
        
        students = cursor.fetchall()
        print(f"\n👥 Sample students and their borrowing limits:")
        print("=" * 100)
        print(f"{'Admission':<12} {'Name':<25} {'Class':<15} {'Limit':<6} {'Active':<8}")
        print("=" * 100)
        
        for student in students:
            admission, first_name, last_name, class_name, limit, active = student
            name = f"{first_name} {last_name}"
            class_name = class_name or "No Class"
            limit = limit or "N/A"
            print(f"{admission:<12} {name:<25} {class_name:<15} {limit:<6} {active:<8}")
        
        # Check for students who might be exceeding limits
        cursor.execute("""
            SELECT s.admission_number, s.first_name, s.last_name, c.class_name, 
                   c.max_books_allowed, COUNT(b.id) as active_borrowings
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN borrowings b ON s.id = b.student_id AND b.status = 'active'
            GROUP BY s.id
            HAVING COUNT(b.id) > COALESCE(c.max_books_allowed, 2)
        """)
        
        over_limit = cursor.fetchall()
        if over_limit:
            print(f"\n⚠️  Students exceeding borrowing limits ({len(over_limit)}):")
            for student in over_limit:
                admission, first_name, last_name, class_name, limit, active = student
                print(f"  - {admission}: {first_name} {last_name} ({active}/{limit} books)")
        else:
            print(f"\n✅ No students are exceeding their borrowing limits")
            
    except sqlite3.Error as e:
        print(f"❌ SQLite error: {e}")
    except Exception as e:
        print(f"❌ General error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_borrowing_limits()
