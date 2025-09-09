#!/usr/bin/env python3
"""
Tool to get ALL students per class using Range headers for proper pagination
Usage: python full_student_analysis.py
"""

import requests
import json

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def get_all_records_with_range(endpoint, select_query="*"):
    """Get all records using Range headers (PostgREST compliant)"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_records = []
    batch_size = 1000
    offset = 0
    
    print(f"📊 Fetching all {endpoint}...")
    
    while True:
        start = offset
        end = offset + batch_size - 1
        
        headers["Range"] = f"{start}-{end}"
        
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}?select={select_query}"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code not in [200, 206]:
            print(f"❌ Error: {response.status_code}")
            return []
        
        batch = response.json()
        
        if not batch:
            break
            
        all_records.extend(batch)
        offset += len(batch)
        
        print(f"  ✅ Fetched {len(batch)} records (total: {len(all_records)})")
        
        if len(batch) < batch_size:
            break
    
    return all_records

def show_full_distribution():
    """Show complete student distribution"""
    
    print("👥 FULL STUDENT DISTRIBUTION WITH PAGINATION")
    print("=" * 60)
    
    try:
        # Get all students using proper pagination
        students = get_all_records_with_range("students")
        print()
        
        if not students:
            print("❌ No students found")
            return
        
        # Group students by class grade
        distribution = {}
        
        for student in students:
            grade = student.get('class_grade', 'Unknown')
            admission = student.get('admission_number', 'Unknown')
            
            if grade not in distribution:
                distribution[grade] = []
            distribution[grade].append(admission)
        
        print("📋 COMPLETE STUDENT DISTRIBUTION:")
        print("-" * 50)
        
        total_students = 0
        
        # Sort by grade level
        sorted_grades = sorted(distribution.items(), key=lambda x: str(x[0]))
        
        for grade, students_list in sorted_grades:
            count = len(students_list)
            total_students += count
            
            print(f"{grade:<20} | {count:4d} students")
            
            # Show sample students for small classes
            if count <= 5 and count > 0:
                sample = students_list[:3]
                print(f"{'':>20} | Students: {', '.join(sample)}")
        
        print("-" * 50)
        print(f"TOTAL STUDENTS: {total_students:,}")
        print(f"TOTAL CLASSES: {len(distribution)}")
        
        # Detailed statistics
        print(f"\n📈 DETAILED STATISTICS:")
        print(f"Average students per class: {total_students/len(distribution):.1f}")
        
        # Find extremes
        if distribution:
            largest = max(distribution.items(), key=lambda x: len(x[1]))
            smallest = min(distribution.items(), key=lambda x: len(x[1]))
            
            print(f"Largest class: {largest[0]} ({len(largest[1]):,} students)")
            print(f"Smallest class: {smallest[0]} ({len(smallest[1])} students)")
        
        # Grade level summary
        print(f"\n📊 GRADE LEVEL SUMMARY:")
        print("-" * 30)
        
        # Group by form level
        form_summary = {}
        for grade, students_list in distribution.items():
            grade_str = str(grade).strip()
            
            # Extract form level
            if 'Form' in grade_str:
                form = grade_str.replace('Form', '').strip().split()[0]
            elif 'Grade' in grade_str:
                form = grade_str.replace('Grade', '').strip().split()[0]
            else:
                form = grade_str
            
            if form not in form_summary:
                form_summary[form] = 0
            form_summary[form] += len(students_list)
        
        for form, count in sorted(form_summary.items(), key=lambda x: str(x[0])):
            print(f"{form:<15} | {count:4d} students")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    show_full_distribution()
