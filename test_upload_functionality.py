#!/usr/bin/env python3
"""
Test script to verify the upload functionality works correctly
"""

import sqlite3
import json
from datetime import datetime

def test_local_database_unsynced_records():
    """Check for unsynced records in the local database"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Checking for unsynced records in local database...")
        print("=" * 60)
        
        # Tables to check
        tables = [
            "categories",
            "classes", 
            "staff",
            "students",
            "books",
            "book_copies",
            "borrowings",
            "fines",
            "group_borrowings",
            "theft_reports"
        ]
        
        total_unsynced = 0
        
        for table in tables:
            try:
                # Check if table exists and has synced column
                cursor.execute(f"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = 'synced'")
                has_synced_column = cursor.fetchone()[0] > 0
                
                if has_synced_column:
                    # Count unsynced records
                    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0 OR synced IS NULL")
                    unsynced_count = cursor.fetchone()[0]
                    
                    # Get total count
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    total_count = cursor.fetchone()[0]
                    
                    print(f"📋 {table:<20}: {unsynced_count:>4} unsynced / {total_count:>4} total")
                    total_unsynced += unsynced_count
                    
                    # Show sample unsynced records
                    if unsynced_count > 0:
                        cursor.execute(f"SELECT id FROM {table} WHERE synced = 0 OR synced IS NULL LIMIT 3")
                        sample_ids = [row[0] for row in cursor.fetchall()]
                        print(f"   Sample IDs: {', '.join(sample_ids[:3])}")
                        
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    total_count = cursor.fetchone()[0]
                    print(f"⚠️  {table:<20}: No synced column ({total_count} total records)")
                    
            except sqlite3.Error as e:
                print(f"❌ {table:<20}: Error - {e}")
        
        print("=" * 60)
        print(f"📊 Total unsynced records: {total_unsynced}")
        
        if total_unsynced > 0:
            print("✅ Upload functionality should have records to process!")
        else:
            print("ℹ️  No unsynced records found. Upload will show 'No changes to upload'.")
            
        conn.close()
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")

def create_test_unsynced_record():
    """Create a test unsynced record for testing upload"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create a test category that's unsynced
        test_id = f"test-upload-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        cursor.execute("""
            INSERT INTO categories (id, name, description, shelf_location, synced, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))
        """, (test_id, f"Test Upload Category", "Test category for upload functionality", "TEST-SHELF"))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Created test unsynced category: {test_id}")
        print("   This record should be uploaded when you test the upload functionality.")
        
    except Exception as e:
        print(f"❌ Failed to create test record: {e}")

if __name__ == "__main__":
    print("🧪 Testing Upload Functionality Preparation")
    print()
    
    test_local_database_unsynced_records()
    print()
    
    response = input("Create a test unsynced record for testing? (y/n): ")
    if response.lower() == 'y':
        create_test_unsynced_record()
        print()
        test_local_database_unsynced_records()
