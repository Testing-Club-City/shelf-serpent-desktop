#!/usr/bin/env python3
"""
Check borrowing limits validation with correct column names
"""

import sqlite3
import json
from pathlib import Path

def get_db_path():
    """Get the database path"""
    home = Path.home()
    db_path = home / ".local/share/library-management-system/library.db"
    if not db_path.exists():
        # Try alternative path
        db_path = home / "library-management-system/library.db"
    return db_path

def check_borrowing_limits():
    """Check borrowing limits validation with correct column names"""
    print("📚 === BORROWING LIMITS VALIDATION CHECK ===")
    
    db_path = get_db_path()
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # First, check the actual column names in students table
        cursor.execute("PRAGMA table_info(students)")
        student_columns = [col[1] for col in cursor.fetchall()]
        print(f"📊 Students table columns: {student_columns}")
        
        # Find the correct name column
        name_column = None
        for col in ['student_name', 'name', 'full_name', 'first_name']:
            if col in student_columns:
                name_column = col
                break
        
        if not name_column:
            print("❌ Could not find name column in students table")
            return
        
        print(f"✅ Using name column: {name_column}")
        
        # Check for students exceeding borrowing limits
        query = f"""
        SELECT 
            s.{name_column},
            s.class_id,
            c.class_name,
            c.max_books_allowed,
            COUNT(b.id) as current_borrowings
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN borrowings b ON s.id = b.student_id AND b.status = 'borrowed'
        WHERE c.max_books_allowed IS NOT NULL
        GROUP BY s.id, s.{name_column}, s.class_id, c.class_name, c.max_books_allowed
        HAVING COUNT(b.id) > c.max_books_allowed
        ORDER BY current_borrowings DESC
        LIMIT 20
        """
        
        cursor.execute(query)
        violations = cursor.fetchall()
        
        print(f"\n📊 Students exceeding borrowing limits: {len(violations)}")
        if violations:
            print("⚠️  Top violations:")
            for violation in violations[:10]:
                student_name, class_id, class_name, max_allowed, current = violation
                print(f"  - {student_name} ({class_name}): {current}/{max_allowed} books")
        else:
            print("✅ No students currently exceeding borrowing limits!")
        
        # Check total borrowing statistics
        cursor.execute(f"""
            SELECT 
                COUNT(DISTINCT s.id) as total_students,
                COUNT(DISTINCT CASE WHEN b.status = 'borrowed' THEN s.id END) as students_with_books,
                COUNT(CASE WHEN b.status = 'borrowed' THEN b.id END) as total_active_borrowings
            FROM students s
            LEFT JOIN borrowings b ON s.id = b.student_id
        """)
        
        stats = cursor.fetchone()
        total_students, students_with_books, total_borrowings = stats
        
        print(f"\n📈 Borrowing statistics:")
        print(f"  - Total students: {total_students}")
        print(f"  - Students with active borrowings: {students_with_books}")
        print(f"  - Total active borrowings: {total_borrowings}")
        if students_with_books > 0:
            print(f"  - Average books per borrowing student: {total_borrowings/students_with_books:.2f}")
        
        # Check class distribution of borrowings
        cursor.execute("""
            SELECT 
                c.class_name,
                c.max_books_allowed,
                COUNT(DISTINCT s.id) as students_in_class,
                COUNT(CASE WHEN b.status = 'borrowed' THEN b.id END) as active_borrowings,
                COUNT(DISTINCT CASE WHEN b.status = 'borrowed' THEN s.id END) as students_with_books
            FROM classes c
            LEFT JOIN students s ON c.id = s.class_id
            LEFT JOIN borrowings b ON s.id = b.student_id
            GROUP BY c.id, c.class_name, c.max_books_allowed
            ORDER BY active_borrowings DESC
            LIMIT 15
        """)
        
        class_stats = cursor.fetchall()
        print(f"\n📚 Borrowing by class (top 15):")
        for stat in class_stats:
            class_name, max_books, students_in_class, active_borrowings, students_with_books = stat
            avg_per_student = active_borrowings / students_with_books if students_with_books > 0 else 0
            print(f"  - {class_name}: {active_borrowings} books, {students_with_books}/{students_in_class} students, avg {avg_per_student:.1f} books/student (limit: {max_books})")
        
        # Check if the sync issue is resolved
        cursor.execute("SELECT COUNT(*) FROM classes WHERE max_books_allowed != 2")
        custom_limits = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM classes")
        total_classes = cursor.fetchone()[0]
        
        print(f"\n🔍 Sync status check:")
        print(f"  - Total classes: {total_classes}")
        print(f"  - Classes with custom limits (not 2): {custom_limits}")
        print(f"  - Classes with default limit (2): {total_classes - custom_limits}")
        
        if custom_limits == 0:
            print("❌ SYNC ISSUE: All classes still have default limit of 2!")
            print("   The sync_classes_from_supabase function may not be working correctly.")
        elif custom_limits < total_classes * 0.3:
            print("⚠️  PARTIAL SYNC: Most classes still have default limits.")
        else:
            print("✅ SYNC WORKING: Classes have varied borrowing limits.")
            
    except Exception as e:
        print(f"❌ Error analyzing borrowing validation: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    check_borrowing_limits()
