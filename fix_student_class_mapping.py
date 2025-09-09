#!/usr/bin/env python3
"""
Fix script to resolve student-class data mapping issues
Usage: python fix_student_class_mapping.py
"""

import sqlite3
import os
import requests
import json
from datetime import datetime

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

LOCAL_DB_PATH = os.path.join(
    os.environ.get('APPDATA', ''),
    'shelf-serpent-desktop',
    'shelf_serpent.db'
)

def sync_classes_to_local():
    """Sync classes from Supabase to local SQLite"""
    print("📥 Syncing classes from Supabase...")
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    
    # Fetch all classes
    url = f"{SUPABASE_URL}/rest/v1/classes?select=*&order=form_level,class_section"
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Error fetching classes: {response.status_code}")
        return False
    
    classes = response.json()
    
    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        cursor = conn.cursor()
        
        # Create classes table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                class_name TEXT,
                form_level INTEGER,
                class_section TEXT,
                class_teacher TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        # Insert or update classes
        for cls in classes:
            cursor.execute('''
                INSERT OR REPLACE INTO classes (id, class_name, form_level, class_section, class_teacher, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                cls['id'],
                cls['class_name'],
                cls['form_level'],
                cls['class_section'],
                cls.get('class_teacher', ''),
                cls.get('created_at', ''),
                cls.get('updated_at', '')
            ))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Synced {len(classes)} classes to local database")
        return True
        
    except Exception as e:
        print(f"❌ Error syncing classes: {e}")
        return False

def sync_students_to_local():
    """Sync students from Supabase to local SQLite"""
    print("📥 Syncing students from Supabase...")
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    
    # Fetch all students with pagination
    all_students = []
    offset = 0
    limit = 1000
    
    while True:
        url = f"{SUPABASE_URL}/rest/v1/students?select=*&limit={limit}&offset={offset}"
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Error fetching students: {response.status_code}")
            return False
            
        students = response.json()
        if not students:
            break
            
        all_students.extend(students)
        offset += limit
        print(f"📊 Fetched {len(all_students)} students...")
    
    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        cursor = conn.cursor()
        
        # Create students table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                admission_number TEXT UNIQUE,
                email TEXT,
                phone TEXT,
                class_grade TEXT,
                status TEXT,
                academic_year TEXT,
                gender TEXT,
                date_of_birth TEXT,
                guardian_contact TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        # Insert or update students
        for student in all_students:
            cursor.execute('''
                INSERT OR REPLACE INTO students (id, first_name, last_name, admission_number, email, phone, class_grade, status, academic_year, gender, date_of_birth, guardian_contact, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                student['id'],
                student['first_name'],
                student['last_name'],
                student['admission_number'],
                student.get('email', ''),
                student.get('phone', ''),
                student.get('class_grade', ''),
                student.get('status', 'active'),
                student.get('academic_year', ''),
                student.get('gender', ''),
                student.get('date_of_birth', ''),
                student.get('guardian_contact', ''),
                student.get('created_at', ''),
                student.get('updated_at', '')
            ))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Synced {len(all_students)} students to local database")
        return True
        
    except Exception as e:
        print(f"❌ Error syncing students: {e}")
        return False

def fix_class_mapping():
    """Fix the class mapping between students and classes"""
    print("🔧 Fixing class mapping...")
    
    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.row_factory = sqlite3.Row
        
        # Get current data
        classes = conn.execute("SELECT * FROM classes").fetchall()
        students = conn.execute("SELECT * FROM students").fetchall()
        
        classes = [dict(row) for row in classes]
        students = [dict(row) for row in students]
        
        # Create class mapping
        class_mapping = {}
        for cls in classes:
            # Map by class_name and form_level+class_section
            key1 = cls['class_name']
            key2 = f"{cls['form_level']}{cls['class_section']}"
            class_mapping[key1] = cls
            class_mapping[key2] = cls
        
        # Check for issues
        issues = []
        for student in students:
            class_grade = student.get('class_grade')
            if class_grade and class_grade not in class_mapping:
                issues.append({
                    'student': f"{student['first_name']} {student['last_name']}",
                    'admission_number': student['admission_number'],
                    'class_grade': class_grade,
                    'suggested_fix': 'Update class_grade to match actual class names'
                })
        
        if issues:
            print(f"⚠️  Found {len(issues)} mapping issues:")
            for issue in issues[:5]:  # Show first 5
                print(f"   - {issue['student']} ({issue['admission_number']}) -> {issue['class_grade']}")
            
            # Generate fix recommendations
            print(f"\n📋 Fix Recommendations:")
            print("1. Update student class_grade values to match actual class names")
            print("2. Ensure class names are consistent between students and classes")
            print("3. Consider using class_id as foreign key instead of class_grade")
            
            return issues
        else:
            print("✅ No class mapping issues found")
            return []
            
    except Exception as e:
        print(f"❌ Error fixing class mapping: {e}")
        return []

def generate_fix_report():
    """Generate comprehensive fix report"""
    print("🚀 Student-Class Data Fix Report")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check if local database exists
    if not os.path.exists(LOCAL_DB_PATH):
        print(f"❌ Local database not found at: {LOCAL_DB_PATH}")
        print("Please run the application first to create the database")
        return
    
    # Sync data
    classes_synced = sync_classes_to_local()
    students_synced = sync_students_to_local()
    
    if classes_synced and students_synced:
        print("\n✅ Data sync completed successfully")
        
        # Fix mapping
        issues = fix_class_mapping()
        
        if issues:
            print(f"\n⚠️  {len(issues)} issues need manual attention")
            print("Please review the issues above and apply fixes as needed")
        else:
            print("\n✅ All class mappings are correct")
    else:
        print("\n❌ Data sync failed - please check your connection")
    
    print(f"\n📋 Next Steps:")
    print("1. Restart the application to use updated data")
    print("2. Test the new useStudentsWithClasses hook")
    print("3. Verify student-class relationships in the UI")
    print("4. Monitor for any remaining issues")

if __name__ == "__main__":
    generate_fix_report()
