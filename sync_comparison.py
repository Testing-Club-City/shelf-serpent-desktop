#!/usr/bin/env python3
"""
Comprehensive comparison between local SQLite and Supabase
Usage: python sync_comparison.py
"""

import sqlite3
import os
import requests

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def get_local_db_path():
    """Get the local SQLite database path"""
    return os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")

def get_supabase_data(endpoint, select_query="*"):
    """Get data from Supabase using Range headers"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_records = []
    batch_size = 1000
    offset = 0
    
    while True:
        start = offset
        end = offset + batch_size - 1
        
        headers["Range"] = f"{start}-{end}"
        
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}?select={select_query}"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code not in [200, 206]:
            return []
        
        batch = response.json()
        
        if not batch:
            break
            
        all_records.extend(batch)
        offset += len(batch)
        
        if len(batch) < batch_size:
            break
    
    return all_records

def get_local_data(table_name):
    """Get data from local SQLite"""
    db_path = get_local_db_path()
    
    if not os.path.exists(db_path):
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute(f"SELECT * FROM {table_name}")
        data = cursor.fetchall()
        
        cursor.execute(f"PRAGMA table_info({table_name});")
        schema = cursor.fetchall()
        
        conn.close()
        
        return {
            'data': data,
            'schema': schema,
            'count': len(data)
        }
        
    except Exception as e:
        return {'error': str(e)}

def show_sync_comparison():
    """Show comprehensive sync comparison"""
    
    print("🔍 LOCAL vs SUPABASE SYNC COMPARISON")
    print("=" * 60)
    
    # Classes comparison
    print("📊 CLASSES COMPARISON:")
    print("-" * 30)
    
    # Local classes
    local_classes = get_local_data('classes')
    if local_classes and 'error' not in local_classes:
        print(f"Local Classes: {local_classes['count']}")
        if local_classes['data']:
            print("Local Classes Sample:")
            for cls in local_classes['data'][:3]:
                print(f"  {cls}")
    else:
        print("Local Classes: Error or not found")
    
    # Supabase classes
    supabase_classes = get_supabase_data('classes')
    print(f"Supabase Classes: {len(supabase_classes)}")
    if supabase_classes:
        print("Supabase Classes Sample:")
        for cls in supabase_classes[:3]:
            print(f"  {cls}")
    
    print()
    
    # Students comparison
    print("👥 STUDENTS COMPARISON:")
    print("-" * 30)
    
    # Local students
    local_students = get_local_data('students')
    if local_students and 'error' not in local_students:
        print(f"Local Students: {local_students['count']}")
        
        # Get local distribution
        if local_students['data']:
            db_path = get_local_db_path()
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT class_grade, COUNT(*) 
                FROM students 
                GROUP BY class_grade 
                ORDER BY COUNT(*) DESC;
            """)
            
            local_dist = cursor.fetchall()
            conn.close()
            
            print("Local Distribution:")
            for grade, count in local_dist:
                print(f"  {grade}: {count} students")
    
    # Supabase students
    supabase_students = get_supabase_data('students')
    print(f"Supabase Students: {len(supabase_students)}")
    
    if supabase_students:
        # Get supabase distribution
        supabase_dist = {}
        for student in supabase_students:
            grade = student.get('class_grade', 'Unknown')
            if grade not in supabase_dist:
                supabase_dist[grade] = 0
            supabase_dist[grade] += 1
        
        print("Supabase Distribution:")
        for grade, count in sorted(supabase_dist.items(), key=lambda x: x[1], reverse=True):
            print(f"  {grade}: {count} students")
    
    print()
    
    # Summary
    print("📊 SYNC SUMMARY:")
    print("-" * 30)
    
    local_student_count = local_students['count'] if local_students and 'error' not in local_students else 0
    local_class_count = local_classes['count'] if local_classes and 'error' not in local_classes else 0
    
    supabase_student_count = len(supabase_students)
    supabase_class_count = len(supabase_classes)
    
    print(f"Students Missing: {supabase_student_count - local_student_count:,}")
    print(f"Classes Missing: {supabase_class_count - local_class_count}")
    print(f"Sync Status: {'Complete' if local_student_count == supabase_student_count else 'Incomplete'}")
    
    # Additional tables
    print("\n📋 OTHER TABLES:")
    print("-" * 30)
    
    tables_to_check = ['books', 'borrowings', 'book_copies', 'fines', 'theft_reports']
    
    for table in tables_to_check:
        local_data = get_local_data(table)
        supabase_data = get_supabase_data(table)
        
        local_count = local_data['count'] if local_data and 'error' not in local_data else 0
        supabase_count = len(supabase_data)
        
        print(f"{table}:")
        print(f"  Local: {local_count}")
        print(f"  Supabase: {supabase_count}")
        if local_count != supabase_count:
            print(f"  Missing: {supabase_count - local_count}")

if __name__ == "__main__":
    show_sync_comparison()
