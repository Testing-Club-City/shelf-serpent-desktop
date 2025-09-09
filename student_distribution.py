#!/usr/bin/env python3
"""
Tool to show actual student distribution by class grade
Usage: python student_distribution.py
"""

import requests
import json

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def show_student_distribution():
    """Show student distribution by class"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    print("👥 STUDENT DISTRIBUTION BY CLASS")
    print("=" * 50)
    
    try:
        # Get all students with their class information
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
        
        # Group students by class grade
        class_distribution = {}
        
        for student in students:
            class_grade = student.get('class_grade', 'Unknown')
            admission_number = student.get('admission_number', 'Unknown')
            
            if class_grade not in class_distribution:
                class_distribution[class_grade] = []
            class_distribution[class_grade].append(admission_number)
        
        # Display results
        print("📋 STUDENTS BY CLASS:")
        print("-" * 40)
        
        total_students = 0
        sorted_classes = sorted(class_distribution.items(), 
                              key=lambda x: (str(x[0]).split()[0] if x[0] != 'Unknown' else 'Z'))
        
        for class_grade, students_list in sorted_classes:
            student_count = len(students_list)
            total_students += student_count
            
            print(f"{class_grade:<15} | {student_count:3d} students")
            
            # Show sample students for small classes
            if student_count <= 5:
                sample = students_list[:3]
                print(f"{'':>15} | Students: {', '.join(sample)}")
            elif student_count <= 20:
                sample = students_list[:3]
                print(f"{'':>15} | Students: {', '.join(sample)}...")
        
        print("-" * 40)
        print(f"TOTAL: {total_students} students")
        
        # Summary statistics
        print("\n📊 SUMMARY:")
        print("-" * 30)
        
        # Count by form level
        form_counts = {}
        for class_grade, students_list in class_distribution.items():
            # Extract form level from class grade
            grade_str = str(class_grade)
            if 'Form' in grade_str:
                form = grade_str.replace('Form', '').strip()
            elif 'Grade' in grade_str:
                form = grade_str.replace('Grade', '').strip()
            else:
                form = grade_str
            
            if form not in form_counts:
                form_counts[form] = 0
            form_counts[form] += len(students_list)
        
        for form, count in sorted(form_counts.items(), key=lambda x: str(x[0])):
            print(f"{form}: {count} students")
        
        # Average per class
        class_count = len(class_distribution)
        if class_count > 0:
            avg_per_class = total_students / class_count
            print(f"Average per class: {avg_per_class:.1f}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    show_student_distribution()
