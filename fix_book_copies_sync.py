#!/usr/bin/env python3
"""
Fix for book copies sync to update existing records with missing legacy_book_id
"""

import sqlite3
import requests
import os
from pathlib import Path

def get_db_path():
    return Path(os.environ.get('APPDATA', '')) / 'library-management-system' / 'library.db'

def main():
    db_path = get_db_path()
    print(f"📁 Database: {db_path}")
    
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()
    
    # Find all local records that exist but have no legacy_book_id
    print("🔍 Finding records with missing legacy_book_id...")
    cursor.execute("SELECT id FROM book_copies WHERE legacy_book_id IS NULL OR legacy_book_id = 0")
    missing_legacy_ids = [row[0] for row in cursor.fetchall()]
    print(f"Found {len(missing_legacy_ids)} records with missing legacy_book_id")
    
    if not missing_legacy_ids:
        print("✅ All records already have legacy_book_id")
        conn.close()
        return
    
    # Fetch these records from Supabase to get their legacy_book_id
    headers = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'
    }
    
    print("📡 Fetching legacy_book_id values from Supabase...")
    updated_count = 0
    
    # Process in batches of 50
    for i in range(0, len(missing_legacy_ids), 50):
        batch_ids = missing_legacy_ids[i:i+50]
        id_list = ','.join(f'"{id_val}"' for id_val in batch_ids)
        
        print(f"📥 Processing batch {i//50 + 1} ({len(batch_ids)} records)...")
        
        response = requests.get(
            'https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies',
            headers=headers,
            params={
                'select': 'id,legacy_book_id',
                'id': f'in.({id_list})',
                'limit': 50
            }
        )
        
        if response.status_code != 200:
            print(f"❌ Error fetching batch: {response.status_code}")
            continue
            
        supabase_records = response.json()
        print(f"📊 Found {len(supabase_records)} records in Supabase for this batch")
        
        # Update local records with legacy_book_id from Supabase
        for record in supabase_records:
            record_id = record.get('id')
            legacy_book_id = record.get('legacy_book_id')
            
            if legacy_book_id is not None:
                cursor.execute(
                    "UPDATE book_copies SET legacy_book_id = ?, updated_at = datetime('now') WHERE id = ?",
                    (legacy_book_id, record_id)
                )
                
                if cursor.rowcount > 0:
                    updated_count += 1
                    if updated_count % 100 == 0:
                        print(f"📖 Updated {updated_count} records so far...")
        
        conn.commit()
    
    print(f"✅ Updated {updated_count} records with legacy_book_id from Supabase")
    
    # Final verification
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL AND legacy_book_id != 0")
    total_with_legacy = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total_records = cursor.fetchone()[0]
    
    print(f"📊 Final status: {total_with_legacy}/{total_records} records have legacy_book_id")
    
    conn.close()

if __name__ == "__main__":
    main()
