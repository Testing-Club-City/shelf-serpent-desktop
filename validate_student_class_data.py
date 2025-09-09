#!/usr/bin/env python3
"""
Comprehensive tool to validate and fix student-class data consistency
Usage: python validate_student_class_data.py
"""

import sqlite3
import os
import requests
import json
from datetime import datetime

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

# Local database path
LOCAL_DB_PATH = os.path.join(
    os.environ.get('APPDATA', ''),
    'shelf-serpent-desktop',
    'shelf_serpent.db'
)

def get_local_data():
    """Get data from local SQLite database"""
    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.row_factory = sqlite3.Row
        
        # Get classes
        classes_query = "SELECT * FROM classes ORDER BY form_level, class_section"
        classes = conn.execute(classes_query).fetchall()
        
        # Get students
        students_query = "SELECT * FROM students ORDER BY first_name, last_name"
        students = conn.execute(students_query).fetchall()
        
        conn.close()
        
        return {
            'classes': [dict(row) for row in classes],
            'students': [dict(row) for row in students],
            'class_count': len(classes),
            'student_count': len(students)
        }
        
    except Exception as e:
        print(f"❌ Error accessing local database: {e}")
        return None

def get_supabase_data():
    """Get data from Supabase with proper pagination"""
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    
    def fetch_all(endpoint):
        all_data = []
        offset = 0
        limit = 1000
        
        while True:
            url = f"{SUPABASE_URL}/rest/v1/{endpoint}?select=*&limit={limit}&offset={offset}"
            response = requests.get(url, headers=headers)
            
            if response.status_code != 200:
                print(f"❌ Error fetching {endpoint}: {response.status_code}")
                break
                
            data = response.json()
            if not data:
                break
                
            all_data.extend(data)
            offset += limit
            
        return all_data
    
    try:
        classes = fetch_all('classes')
        students = fetch_all('students')
        
        return {
            'classes': classes,
            'students': students,
            'class_count': len(classes),
            'student_count': len(students)
        }
        
    except Exception as e:
        print(f"❌ Error accessing Supabase: {e}")
        return None

def validate_relationships(local_data, supabase_data):
    """Validate student-class relationships"""
    print("\n🔍 Validating Student-Class Relationships...")
    
    issues = []
    
    # Check local data
    if local_data:
        local_classes = {c['id']: c for c in local_data['classes']}
        local_students = local_data['students']
        
        print(f"📊 Local: {len(local_classes)} classes, {len(local_students)} students")
        
        # Check for orphaned students
        orphaned_students = []
        for student in local_students:
            class_grade = student.get('class_grade')
            if class_grade:
                # Map class_grade to actual class
                matching_classes = [
                    c for c in local_data['classes']
                    if f"{c.get('form_level', '')}{c.get('class_section', '')}" == class_grade
                ]
                
                if not matching_classes:
                    orphaned_students.append({
                        'student': f"{student.get('first_name')} {student.get('last_name')}",
                        'admission_number': student.get('admission_number'),
                        'class_grade': class_grade
                    })
        
        if orphaned_students:
            issues.append({
                'type': 'orphaned_students',
                'count': len(orphaned_students),
                'students': orphaned_students[:5]  # Show first 5
            })
    
    # Check Supabase data
    if supabase_data:
        supabase_classes = {c['id']: c for c in supabase_data['classes']}
        supabase_students = supabase_data['students']
        
        print(f"📊 Supabase: {len(supabase_classes)} classes, {len(supabase_students)} students")
        
        # Check for students without valid class references
        invalid_class_refs = []
        for student in supabase_students:
            class_grade = student.get('class_grade')
            if class_grade:
                # Check if this class exists
                valid_class = any(
                    f"{c.get('form_level', '')}{c.get('class_section', '')}" == class_grade
                    for c in supabase_data['classes']
                )
                
                if not valid_class:
                    invalid_class_refs.append({
                        'student': f"{student.get('first_name')} {student.get('last_name')}",
                        'admission_number': student.get('admission_number'),
                        'class_grade': class_grade
                    })
        
        if invalid_class_refs:
            issues.append({
                'type': 'invalid_class_references',
                'count': len(invalid_class_refs),
                'students': invalid_class_refs[:5]
            })
    
    return issues

def generate_report():
    """Generate comprehensive validation report"""
    print("🚀 Student-Class Data Validation Report")
    print("=" * 50)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get data from both sources
    local_data = get_local_data()
    supabase_data = get_supabase_data()
    
    if not local_data and not supabase_data:
        print("❌ Cannot access any data sources")
        return
    
    # Display data counts
    if local_data:
        print(f"\n📊 Local Database:")
        print(f"   Classes: {local_data['class_count']}")
        print(f"   Students: {local_data['student_count']}")
    
    if supabase_data:
        print(f"\n📊 Supabase Database:")
        print(f"   Classes: {supabase_data['class_count']}")
        print(f"   Students: {supabase_data['student_count']}")
    
    # Validate relationships
    issues = validate_relationships(local_data, supabase_data)
    
    if issues:
        print(f"\n⚠️  Issues Found: {len(issues)}")
        for issue in issues:
            print(f"\n   {issue['type']}: {issue['count']} occurrences")
            if issue['students']:
                for student in issue['students']:
                    print(f"     - {student['student']} ({student['admission_number']}) -> {student['class_grade']}")
    else:
        print("\n✅ No issues found")
    
    # Recommendations
    print(f"\n📋 Recommendations:")
    print("1. Run comprehensive sync to align local database with Supabase")
    print("2. Verify class naming consistency between students and classes")
    print("3. Update student records to use proper class references")
    print("4. Test the new useStudentsWithClasses hook")
    
    # Sync command
    print(f"\n🔄 To sync data:")
    print("   cargo tauri dev")
    print("   Then trigger sync from UI or run:")
    print("   python sync_students_to_local.py")
    print("   python sync_classes_to_local.py")

if __name__ == "__main__":
    generate_report()
