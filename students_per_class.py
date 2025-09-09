#!/usr/bin/env python3
"""
Tool to show how many students are in each class
Usage: python students_per_class.py
"""

import requests
import json

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def show_students_per_class():
    """Show student count per class"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    print("👥 STUDENTS PER CLASS ANALYSIS")
    print("=" * 50)
    
    try:
        # First, get all classes
        classes_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/classes?select=*",
            headers=headers
        )
        
        if classes_response.status_code != 200:
            print(f"❌ Error getting classes: {classes_response.status_code}")
            return
            
        classes = classes_response.json()
        print(f"📊 Found {len(classes)} classes")
        print()
        
        # Get students with their classes
        students_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/students?select=*",
            headers=headers
        )
        
        if students_response.status_code != 200:
            print(f"❌ Error getting students: {students_response.status_code}")
            return
            
        students = students_response.json()
        print(f"📊 Found {len(students)} total students")
        print()
        
        # Map students to classes
        class_students = {}
        for student in students:
            class_grade = student.get('class_grade', 'Unknown')
            if class_grade not in class_students:
                class_students[class_grade] = []
            class_students[class_grade].append(student)
        
        # Match classes with students
        print("📋 CLASS STUDENT DISTRIBUTION:")
        print("-" * 40)
        
        total_students = 0
        for cls in sorted(classes, key=lambda x: (x.get('form_level') or 0, x.get('class_section') or '')):
            class_id = cls.get('id')
            class_name = cls.get('class_name', 'Unnamed')
            form_level = cls.get('form_level', 0)
            class_section = cls.get('class_section', '')
            
            # Find students for this class
            students_in_class = []
            for student in students:
                # Match by form level and section
                student_class = str(student.get('class_grade', ''))
                if str(form_level) in student_class:
                    students_in_class.append(student)
            
            student_count = len(students_in_class)
            total_students += student_count
            
            full_class_name = f"Form {form_level}{class_section}" if class_section else f"Form {form_level}"
            
            print(f"{full_class_name:<15} | {class_name:<15} | {student_count:3d} students")
            
            # Show some student names if available
            if students_in_class and student_count <= 5:
                names = [s.get('admission_number', 'Unknown') for s in students_in_class[:3]]
                print(f"{'':>15} | {'':>15} | Students: {', '.join(names)}")
            elif students_in_class and student_count > 5:
                names = [s.get('admission_number', 'Unknown') for s in students_in_class[:3]]
                print(f"{'':>15} | {'':>15} | Students: {', '.join(names)}... ({student_count-3} more)")
        
        print("-" * 40)
        print(f"TOTAL STUDENTS: {total_students}")
        
        # Summary statistics
        print("\n📊 SUMMARY STATISTICS:")
        print("-" * 30)
        
        # Students per form level
        form_levels = {}
        for student in students:
            grade = student.get('class_grade', 'Unknown')
            form = str(grade).split()[0] if grade != 'Unknown' else 'Unknown'
            form_levels[form] = form_levels.get(form, 0) + 1
        
        for form, count in sorted(form_levels.items()):
            print(f"Form {form}: {count} students")
        
        # Average students per class
        classes_with_students = [k for k, v in class_students.items() if v]
        avg_students = total_students / len(classes) if classes else 0
        print(f"Average students per class: {avg_students:.1f}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    show_students_per_class()
