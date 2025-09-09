#!/usr/bin/env python3
"""
Tool to sync all classes from Supabase to local SQLite database
Usage: python sync_classes_to_local.py
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

def get_all_supabase_classes():
    """Get all classes from Supabase"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_classes = []
    batch_size = 1000
    offset = 0
    
    print("📊 Fetching all classes from Supabase...")
    
    while True:
        start = offset
        end = offset + batch_size - 1
        
        headers["Range"] = f"{start}-{end}"
        
        url = f"{SUPABASE_URL}/rest/v1/classes?select=*"
        
        response = requests.get(url, headers=headers)
        
        if response.status_code not in [200, 206]:
            print(f"❌ Error: {response.status_code}")
            return []
        
        batch = response.json()
        
        if not batch:
            break
            
        all_classes.extend(batch)
        offset += len(batch)
        
        print(f"  ✅ Fetched {len(batch)} records (total: {len(all_classes)})")
        
        if len(batch) < batch_size:
            break
    
    return all_classes

def sync_classes_to_local():
    """Sync all classes from Supabase to local SQLite"""
    
    db_path = get_local_db_path()
    
    print("🔄 SYNCING CLASSES FROM SUPABASE TO LOCAL")
    print("=" * 60)
    print(f"Database: {db_path}")
    print()
    
    if not os.path.exists(db_path):
        print("❌ Local database not found")
        return
    
    try:
        # Get all classes from Supabase
        supabase_classes = get_all_supabase_classes()
        
        if not supabase_classes:
            print("❌ No classes found in Supabase")
            return
        
        print(f"\n📊 Found {len(supabase_classes)} classes in Supabase")
        
        # Connect to local database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get current local class count
        cursor.execute("SELECT COUNT(*) FROM classes;")
        local_count_before = cursor.fetchone()[0]
        print(f"📊 Local classes before sync: {local_count_before}")
        
        # Get local class IDs to avoid duplicates
        cursor.execute("SELECT id FROM classes;")
        local_class_ids = {row[0] for row in cursor.fetchall()}
        
        # Prepare for insertion
        new_classes = []
        for cls in supabase_classes:
            class_id = cls.get('id')
            if class_id not in local_class_ids:
                new_classes.append(cls)
        
        print(f"📊 New classes to insert: {len(new_classes)}")
        
        if new_classes:
            # Insert new classes
            inserted_count = 0
            for cls in new_classes:
                try:
                    cursor.execute("""
                        INSERT INTO classes (
                            id, class_name, form_level, class_section, 
                            max_books_allowed, is_active, created_at, updated_at,
                            academic_level_type, synced, sync_version, deleted
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        cls.get('id'),
                        cls.get('class_name'),
                        cls.get('form_level'),
                        cls.get('class_section'),
                        cls.get('max_books_allowed'),
                        cls.get('is_active'),
                        cls.get('created_at'),
                        cls.get('updated_at'),
                        cls.get('academic_level_type'),
                        cls.get('synced'),
                        cls.get('sync_version'),
                        cls.get('deleted')
                    ))
                    inserted_count += 1
                    
                    if inserted_count % 5 == 0:
                        print(f"  ✅ Inserted {inserted_count} classes...")
                        conn.commit()
                        
                except Exception as e:
                    print(f"❌ Error inserting class {cls.get('class_name')}: {e}")
            
            # Final commit
            conn.commit()
            
            # Get final count
            cursor.execute("SELECT COUNT(*) FROM classes;")
            local_count_after = cursor.fetchone()[0]
            
            print(f"\n✅ CLASSES SYNC COMPLETED!")
            print(f"Classes inserted: {inserted_count}")
            print(f"Local classes before: {local_count_before}")
            print(f"Local classes after: {local_count_after}")
            print(f"Total classes now: {local_count_after}")
            
        else:
            print("✅ All classes already synced!")
        
        # Show updated classes
        cursor.execute("""
            SELECT class_name, form_level, class_section, max_books_allowed, is_active
            FROM classes
            ORDER BY form_level, class_section;
        """)
        
        classes = cursor.fetchall()
        
        print(f"\n📋 UPDATED LOCAL CLASSES:")
        print("-" * 50)
        for cls in classes:
            print(f"  {cls[0]} (Form {cls[1]}{cls[2]}): {cls[3]} books, Active: {cls[4]}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Sync error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    sync_classes_to_local()
