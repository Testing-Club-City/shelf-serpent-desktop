#!/usr/bin/env python3
"""
Tool to get ALL students per class, handling Supabase pagination
Usage: python complete_student_analysis.py
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
    batch_size = 1000
    
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

def show_complete_distribution():
    """Show complete student distribution"""
    
    print("👥 COMPLETE STUDENT DISTRIBUTION")
    print("=" * 50)
    
    try:
        # Get all students
        students = get_all_records("students")
        print(f"📊 Found {len(students)} total students")
        print()
        
        if not students:
            print("❌ No students found")
            return
        
        # Group by class grade
        distribution = {}
        for student in students:
            grade = student.get('class_grade', 'Unknown')
            if grade not in distribution:
                distribution[grade] = []
            distribution[grade].append(student.get('admission_number', 'Unknown'))
        
        # Display results
        print("📋 STUDENTS BY CLASS GRADE:")
        print("-" * 40)
        
        total_students = 0
        
        for grade, students_list in sorted(distribution.items()):
            count = len(students_list)
            total_students += count
            
            print(f"{grade:<15} | {count:4d} students")
        
        print("-" * 40)
        print(f"TOTAL: {total_students} students")
        print(f"CLASSES: {len(distribution)}")
        
        # Find largest and smallest
        if distribution:
            largest = max(distribution.items(), key=lambda x: len(x[1]))
            smallest = min(distribution.items(), key=lambda x: len(x[1]))
            
            print(f"\n📈 STATISTICS:")
            print(f"Largest class: {largest[0]} ({len(largest[1])} students)")
            print(f"Smallest class: {smallest[0]} ({len(smallest[1])} students)")
            print(f"Average: {total_students/len(distribution):.1f} students per class")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    show_complete_distribution()
