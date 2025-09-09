#!/usr/bin/env python3
"""
Check the schema of the students table
"""

import sqlite3
import os

def main():
    db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    print(f"🔍 Checking students table schema")
    
    # Get table schema
    cursor = conn.execute("PRAGMA table_info(students)")
    columns = cursor.fetchall()
    
    print(f"📋 Students table columns:")
    for col in columns:
        print(f"  - {col['name']} ({col['type']}) {'NOT NULL' if col['notnull'] else 'NULL'}")
    
    # Test search for admission number 20232
    print(f"\n🔍 Searching for admission number 20232:")
    cursor = conn.execute("""
        SELECT admission_number, first_name, last_name, class_grade, email, phone
        FROM students 
        WHERE admission_number = '20232'
        LIMIT 5
    """)
    
    students = cursor.fetchall()
    print(f"📚 Found {len(students)} students:")
    for student in students:
        print(f"  - {student['first_name']} {student['last_name']} ({student['admission_number']})")
        print(f"    Class: {student['class_grade']}")
        print(f"    Email: {student['email']}")
        print(f"    Phone: {student['phone']}")
    
    # Also test partial search
    print(f"\n🔍 Searching for admission numbers containing '20232':")
    cursor = conn.execute("""
        SELECT admission_number, first_name, last_name, class_grade
        FROM students 
        WHERE admission_number LIKE '%20232%'
        LIMIT 5
    """)
    
    students = cursor.fetchall()
    print(f"📚 Found {len(students)} students:")
    for student in students:
        print(f"  - {student['first_name']} {student['last_name']} ({student['admission_number']})")
    
    conn.close()

if __name__ == "__main__":
    main()