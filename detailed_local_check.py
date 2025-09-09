#!/usr/bin/env python3
"""
Detailed local SQLite database checker
Usage: python detailed_local_check.py
"""

import sqlite3
import os

def get_local_db_path():
    """Get the local SQLite database path"""
    return os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")

def show_detailed_local():
    """Show detailed local database information"""
    
    db_path = get_local_db_path()
    
    print("🏠 LOCAL DATABASE DETAILS")
    print("=" * 60)
    print(f"Database Path: {db_path}")
    print()
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get database info
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        tables = cursor.fetchall()
        
        print(f"📋 Found {len(tables)} tables:")
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"  {table_name}: {count} records")
        print()
        
        # Detailed classes analysis
        print("📊 CLASSES DETAILS:")
        print("-" * 30)
        
        try:
            cursor.execute("SELECT COUNT(*) FROM classes;")
            class_count = cursor.fetchone()[0]
            print(f"Total Classes: {class_count}")
            
            if class_count > 0:
                cursor.execute("SELECT * FROM classes ORDER BY form_level, class_section LIMIT 10;")
                classes = cursor.fetchall()
                
                cursor.execute("PRAGMA table_info(classes);")
                schema = cursor.fetchall()
                
                print("Schema:")
                for col in schema:
                    print(f"  {col[1]} ({col[2]})")
                
                print("Sample Classes:")
                for cls in classes:
                    print(f"  {cls}")
            
        except Exception as e:
            print(f"Classes error: {e}")
        
        print()
        
        # Detailed students analysis
        print("👥 STUDENTS DETAILS:")
        print("-" * 30)
        
        try:
            cursor.execute("SELECT COUNT(*) FROM students;")
            student_count = cursor.fetchone()[0]
            print(f"Total Students: {student_count}")
            
            if student_count > 0:
                cursor.execute("SELECT * FROM students LIMIT 5;")
                students = cursor.fetchall()
                
                cursor.execute("PRAGMA table_info(students);")
                schema = cursor.fetchall()
                
                print("Schema:")
                for col in schema:
                    print(f"  {col[1]} ({col[2]})")
                
                print("Sample Students:")
                for student in students:
                    print(f"  {student}")
            
        except Exception as e:
            print(f"Students error: {e}")
        
        print()
        
        # Students per class summary
        print("📈 STUDENTS PER CLASS SUMMARY:")
        print("-" * 40)
        
        try:
            cursor.execute("""
                SELECT 
                    class_grade,
                    COUNT(*) as student_count,
                    MIN(admission_number) as first_student,
                    MAX(admission_number) as last_student
                FROM students 
                GROUP BY class_grade 
                ORDER BY student_count DESC;
            """)
            
            distribution = cursor.fetchall()
            
            total_students = 0
            for grade, count, first, last in distribution:
                total_students += count
                print(f"{grade:<15} | {count:3d} students | {first}...{last}")
            
            print("-" * 40)
            print(f"TOTAL: {total_students} students in {len(distribution)} classes")
            
        except Exception as e:
            print(f"Distribution error: {e}")
        
        # Compare with Supabase (conceptual)
        print()
        print("🔍 LOCAL VS SUPABASE COMPARISON:")
        print("-" * 40)
        
        # Local counts
        local_students = 500  # From our analysis
        local_classes = 3   # From our analysis
        
        # Supabase counts (from previous analysis)
        supabase_students = 4788
        supabase_classes = 26
        
        print(f"Local Students: {local_students}")
        print(f"Supabase Students: {supabase_students}")
        print(f"Local Classes: {local_classes}")
        print(f"Supabase Classes: {supabase_classes}")
        
        if local_students < supabase_students:
            missing_students = supabase_students - local_students
            print(f"Missing from local: {missing_students} students")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    show_detailed_local()
