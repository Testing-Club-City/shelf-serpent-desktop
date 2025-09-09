#!/usr/bin/env python3
"""
Comprehensive alignment check after student sync
Usage: python alignment_check.py
"""

import sqlite3
import os
import requests

def get_local_db_path():
    """Get the local SQLite database path"""
    return os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")

def check_post_sync_alignment():
    """Check alignment after student sync"""
    
    db_path = get_local_db_path()
    
    print("🔍 POST-SYNC ALIGNMENT CHECK")
    print("=" * 60)
    print(f"Database: {db_path}")
    print()
    
    if not os.path.exists(db_path):
        print("❌ Database not found")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        tables = cursor.fetchall()
        
        print(f"📋 TABLES FOUND: {len(tables)}")
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"  {table_name}: {count} records")
        print()
        
        # Detailed students check
        cursor.execute("SELECT COUNT(*) FROM students;")
        student_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT class_grade, COUNT(*) 
            FROM students 
            GROUP BY class_grade 
            ORDER BY COUNT(*) DESC;
        """)
        
        distribution = cursor.fetchall()
        
        print("👥 STUDENTS ALIGNMENT:")
        print("-" * 30)
        print(f"Total Students: {student_count}")
        
        total_students = 0
        for grade, count in distribution:
            total_students += count
            print(f"  {grade}: {count} students")
        
        # Expected from Supabase (from previous analysis)
        expected_distribution = {
            'Graduated': 3589,
            'Form 4 A': 511,
            'Form 2 A': 364,
            'Form 3 A': 324
        }
        
        print(f"\n✅ ALIGNMENT VERIFICATION:")
        print("-" * 40)
        
        alignment_status = "✅ PERFECTLY ALIGNED"
        
        for grade, expected in expected_distribution.items():
            actual = next((count for g, count in distribution if g == grade), 0)
            status = "✅" if actual == expected else "❌"
            print(f"  {grade}: {actual}/{expected} {status}")
            
            if actual != expected:
                alignment_status = "❌ MISALIGNED"
        
        print(f"\n🎯 FINAL STATUS: {alignment_status}")
        
        # Classes check
        cursor.execute("SELECT COUNT(*) FROM classes;")
        class_count = cursor.fetchone()[0]
        
        print(f"\n📊 CLASSES ALIGNMENT:")
        print(f"Local Classes: {class_count}")
        print(f"Expected Classes: 26 (from Supabase)")
        
        if class_count == 26:
            print("✅ Classes: PERFECTLY ALIGNED")
        else:
            print(f"❌ Classes: {class_count}/26 - MISSING {26-class_count} classes")
        
        # Sample data verification
        cursor.execute("SELECT * FROM students LIMIT 5;")
        sample_students = cursor.fetchall()
        
        print(f"\n📋 SAMPLE STUDENTS:")
        for student in sample_students:
            print(f"  {student}")
        
        # Check for any anomalies
        cursor.execute("SELECT COUNT(*) FROM students WHERE class_grade IS NULL OR class_grade = '';")
        null_grades = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM students WHERE admission_number IS NULL OR admission_number = '';")
        null_admissions = cursor.fetchone()[0]
        
        print(f"\n🔍 DATA QUALITY CHECK:")
        print(f"  Students with NULL class_grade: {null_grades}")
        print(f"  Students with NULL admission_number: {null_admissions}")
        
        if null_grades == 0 and null_admissions == 0:
            print("✅ Data Quality: PERFECT")
        else:
            print("❌ Data Quality: ISSUES FOUND")
        
        conn.close()
        
        # Summary
        print(f"\n🎯 FINAL ALIGNMENT SUMMARY:")
        print("=" * 50)
        
        if student_count == 4788:
            print("✅ STUDENTS: PERFECTLY ALIGNED (4,788 students)")
        else:
            print(f"❌ STUDENTS: MISALIGNED ({student_count}/4,788)")
            
        if class_count == 26:
            print("✅ CLASSES: PERFECTLY ALIGNED (26 classes)")
        else:
            print(f"❌ CLASSES: MISALIGNED ({class_count}/26 classes)")
            
        if null_grades == 0 and null_admissions == 0:
            print("✅ DATA QUALITY: PERFECT")
        else:
            print("❌ DATA QUALITY: NEEDS ATTENTION")
        
    except Exception as e:
        print(f"❌ Alignment check error: {e}")

if __name__ == "__main__":
    check_post_sync_alignment()
