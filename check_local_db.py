#!/usr/bin/env python3
"""
Tool to check local SQLite database for classes and students
Usage: python check_local_db.py
"""

import sqlite3
import os

def get_local_db_path():
    """Get the local SQLite database path"""
    return os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")

def check_local_database():
    """Check local SQLite database for classes and students"""
    
    db_path = get_local_db_path()
    
    print("🏠 LOCAL DATABASE ANALYSIS")
    print("=" * 50)
    print(f"Database: {db_path}")
    print()
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print("📋 AVAILABLE TABLES:")
        for table in tables:
            print(f"  - {table[0]}")
        print()
        
        # Check classes table
        try:
            cursor.execute("SELECT COUNT(*) FROM classes;")
            class_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT * FROM classes LIMIT 5;")
            classes = cursor.fetchall()
            
            cursor.execute("PRAGMA table_info(classes);")
            class_schema = cursor.fetchall()
            
            print("📊 CLASSES TABLE:")
            print(f"  Total classes: {class_count}")
            print("  Schema:")
            for col in class_schema:
                print(f"    {col[1]} ({col[2]})")
            
            if classes:
                print("  Sample data:")
                for cls in classes:
                    print(f"    {cls}")
            print()
            
        except sqlite3.OperationalError as e:
            print(f"❌ Classes table error: {e}")
            print()
        
        # Check students table
        try:
            cursor.execute("SELECT COUNT(*) FROM students;")
            student_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT * FROM students LIMIT 5;")
            students = cursor.fetchall()
            
            cursor.execute("PRAGMA table_info(students);")
            student_schema = cursor.fetchall()
            
            print("📊 STUDENTS TABLE:")
            print(f"  Total students: {student_count}")
            print("  Schema:")
            for col in student_schema:
                print(f"    {col[1]} ({col[2]})")
            
            if students:
                print("  Sample data:")
                for student in students:
                    print(f"    {student}")
            print()
            
        except sqlite3.OperationalError as e:
            print(f"❌ Students table error: {e}")
            print()
        
        # Check if we can get students per class
        try:
            cursor.execute("""
                SELECT class_grade, COUNT(*) as student_count 
                FROM students 
                GROUP BY class_grade 
                ORDER BY student_count DESC;
            """)
            
            distribution = cursor.fetchall()
            
            print("📈 STUDENTS PER CLASS (Local):")
            print("-" * 30)
            
            total_students = 0
            for grade, count in distribution:
                total_students += count
                print(f"{grade:<15} | {count:4d} students")
            
            print("-" * 30)
            print(f"TOTAL: {total_students} students")
            print(f"CLASSES: {len(distribution)}")
            
        except sqlite3.OperationalError as e:
            print(f"❌ Distribution query error: {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

def compare_local_vs_supabase():
    """Compare local vs Supabase data"""
    
    print("\n🔍 LOCAL VS SUPABASE COMPARISON")
    print("=" * 40)
    
    # This would require both local and Supabase connections
    # For now, we'll just show local data
    check_local_database()

if __name__ == "__main__":
    compare_local_vs_supabase()
