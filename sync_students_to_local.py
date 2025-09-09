#!/usr/bin/env python3
"""
Tool to sync all students from Supabase to local SQLite database
Usage: python sync_students_to_local.py
"""

import sqlite3
import os
import requests
import json

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def get_local_db_path():
    """Get the local SQLite database path"""
    return os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")

def get_all_supabase_students():
    """Get all students from Supabase using Range headers"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_students = []
    batch_size = 1000
    offset = 0
    
    print("📊 Fetching all students from Supabase...")
    
    while True:
        start = offset
        end = offset + batch_size - 1
        
        headers["Range"] = f"{start}-{end}"
        
        url = f"{SUPABASE_URL}/rest/v1/students?select=*"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code not in [200, 206]:
            print(f"❌ Error: {response.status_code}")
            return []
        
        batch = response.json()
        
        if not batch:
            break
            
        all_students.extend(batch)
        offset += len(batch)
        
        print(f"  ✅ Fetched {len(batch)} records (total: {len(all_students)})")
        
        if len(batch) < batch_size:
            break
    
    return all_students

def sync_students_to_local():
    """Sync all students from Supabase to local SQLite"""
    
    db_path = get_local_db_path()
    
    print("🔄 SYNCING STUDENTS FROM SUPABASE TO LOCAL")
    print("=" * 60)
    print(f"Database: {db_path}")
    print()
    
    if not os.path.exists(db_path):
        print("❌ Local database not found")
        return
    
    try:
        # Get all students from Supabase
        supabase_students = get_all_supabase_students()
        
        if not supabase_students:
            print("❌ No students found in Supabase")
            return
        
        print(f"\n📊 Found {len(supabase_students)} students in Supabase")
        
        # Connect to local database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get current local student count
        cursor.execute("SELECT COUNT(*) FROM students;")
        local_count_before = cursor.fetchone()[0]
        print(f"📊 Local students before sync: {local_count_before}")
        
        # Get local student IDs to avoid duplicates
        cursor.execute("SELECT admission_number FROM students;")
        local_admission_numbers = {row[0] for row in cursor.fetchall()}
        
        # Prepare for insertion
        new_students = []
        for student in supabase_students:
            admission_number = student.get('admission_number')
            if admission_number not in local_admission_numbers:
                new_students.append(student)
        
        print(f"📊 New students to insert: {len(new_students)}")
        
        if new_students:
            # Insert new students
            inserted_count = 0
            for student in new_students:
                try:
                    cursor.execute("""
                        INSERT INTO students (
                            id, admission_number, first_name, last_name, 
                            class_grade, email, phone, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        student.get('id'),
                        student.get('admission_number'),
                        student.get('first_name'),
                        student.get('last_name'),
                        student.get('class_grade'),
                        student.get('email'),
                        student.get('phone'),
                        student.get('created_at'),
                        student.get('updated_at')
                    ))
                    inserted_count += 1
                    
                    if inserted_count % 100 == 0:
                        print(f"  ✅ Inserted {inserted_count} students...")
                        conn.commit()
                        
                except Exception as e:
                    print(f"❌ Error inserting student {student.get('admission_number')}: {e}")
            
            # Final commit
            conn.commit()
            
            # Get final count
            cursor.execute("SELECT COUNT(*) FROM students;")
            local_count_after = cursor.fetchone()[0]
            
            print(f"\n✅ SYNC COMPLETED!")
            print(f"Students inserted: {inserted_count}")
            print(f"Local students before: {local_count_before}")
            print(f"Local students after: {local_count_after}")
            print(f"Total students now: {local_count_after}")
            
        else:
            print("✅ All students already synced!")
        
        # Show updated distribution
        cursor.execute("""
            SELECT class_grade, COUNT(*) 
            FROM students 
            GROUP BY class_grade 
            ORDER BY COUNT(*) DESC;
        """)
        
        distribution = cursor.fetchall()
        
        print(f"\n📈 UPDATED LOCAL DISTRIBUTION:")
        print("-" * 30)
        for grade, count in distribution:
            print(f"  {grade}: {count} students")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Sync error: {e}")
        import traceback
        traceback.print_exc()

def verify_sync():
    """Verify the sync was successful"""
    
    db_path = get_local_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get final counts
        cursor.execute("SELECT COUNT(*) FROM students;")
        local_total = cursor.fetchone()[0]
        
        # Get distribution
        cursor.execute("""
            SELECT class_grade, COUNT(*) 
            FROM students 
            GROUP BY class_grade 
            ORDER BY COUNT(*) DESC;
        """)
        
        distribution = cursor.fetchall()
        
        print(f"\n✅ VERIFICATION:")
        print(f"Total local students: {local_total}")
        
        print(f"\n📊 Class Distribution:")
        for grade, count in distribution:
            print(f"  {grade}: {count} students")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Verification error: {e}")

if __name__ == "__main__":
    sync_students_to_local()
    verify_sync()
