#!/usr/bin/env python3
"""
Tool to get ALL students per class, handling Supabase pagination
Usage: python all_students_per_class.py
"""

import requests
import json

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def get_all_records(endpoint, select_query="*"):
    """Get all records from Supabase, handling pagination"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_records = []
    offset = 0
    batch_size = 1000  # PostgREST limit
    
    print(f"📊 Fetching all {endpoint}...")
    
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}?select={select_query}&limit={batch_size}&offset={offset}"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            return []
        
        batch = response.json()
        
        if not batch:
            break
            
        all_records.extend(batch)
        offset += batch_size
        
        print(f"  ✅ Fetched {len(batch)} records (total: {len(all_records)})")
        
        if len(batch) < batch_size:
            break
    
    return all_records

def show_complete_student_distribution():
    """Show complete student distribution by class"""
    
    print("👥 COMPLETE STUDENT DISTRIBUTION BY CLASS")
    print("=" * 60)
    
    try:
        # Get all classes
        classes = get_all_records("classes")
        print(f"📊 Found {len(classes)} classes")
        
        # Get all students
        students = get_all_records("students")
        print(f"📊 Found {len(students)} total students")
        print()
        
        if not students:
            print("❌ No students found")
            return
        
        # Group students by class grade
        class_distribution = {}
        
        for student in students:
            class_grade = student.get('class_grade', 'Unknown')
            admission_number = student.get('admission_number', 'Unknown')
            
            if class_grade not in class_distribution:
                class_distribution[class_grade] = []
            class_distribution[class_grade].append(admission_number)
        
        # Display results
        print("📋 COMPLETE STUDENT DISTRIBUTION:")
        print("-" * 50)
        
        total_students = 0
        
        # Sort classes by grade level
        sorted_classes = sorted(class_distribution.items(), 
                              key=lambda x: str(x[0]))
        
        for class_grade, students_list in sorted_classes:
            student_count = len(students_list)
            total_students += student_count
            
            print(f"{class_grade:<20} | {student_count:4d} students")
            
            # Show sample students for small classes
            if student_count <= 5:
                sample = students_list[:3]
                print(f"{'':>20} | Students: {', '.join(sample)}")
        
        print("-" * 50)
        print(f"TOTAL STUDENTS: {total_students}")
        print(f"TOTAL CLASSES: {len(class_distribution)}")
        
        # Summary by form level
        print("\n📊 SUMMARY BY FORM LEVEL:")
        print("-" * 30)
        
        form_summary = {}
        for class_grade, students_list in class_distribution.items():
            # Clean up form level
            form = str(class_grade).strip()
            if form not in form_summary:
                form_summary[form] = 0
            form_summary[form] += len(students_list)
        
        for form, count in sorted(form_summary.items(), key=lambda x: str(x[0])):
            print(f"{form:<15} | {count:4d} students")
        
        # Statistics
        print(f"\n📈 STATISTICS:")
        print(f"Average students per class: {total_students/len(class_distribution):.1f}")
        
        # Find largest and smallest classes
        if class_distribution:
            largest_class = max(class_distribution.items(), key=lambda x: len(x[1]))
            smallest_class = min(class_distribution.items(), key=lambda x: len(x[1]))
            
            print(f"Largest class: {largest_class[0]} ({len(largest_class[1])} students)")
            print(f"Smallest class: {smallest_class[0]} ({len(smallest_class[1])} students)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    show_complete_student_distribution()
