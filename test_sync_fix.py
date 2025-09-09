#!/usr/bin/env python3
"""
Test script to verify the book copies sync fix works correctly
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
    cursor = conn.cursor()
    
    print("📊 Current sync status analysis:")
    
    # Total records
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total_local = cursor.fetchone()[0]
    print(f"  📚 Total local book_copies: {total_local}")
    
    # Records with legacy_book_id
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL AND legacy_book_id != 0")
    with_legacy = cursor.fetchone()[0]
    print(f"  🏷️ With legacy_book_id: {with_legacy}")
    
    # Records without legacy_book_id
    missing_legacy = total_local - with_legacy
    print(f"  ❓ Without legacy_book_id: {missing_legacy}")
    
    # Check Supabase total
    headers = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'
    }
    
    response = requests.get(
        'https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies',
        headers=headers,
        params={'select': 'count'}
    )
    
    if response.status_code == 200:
        supabase_total = response.json()[0]['count']
        print(f"  🌐 Total in Supabase: {supabase_total}")
        
        sync_percentage = (total_local / supabase_total) * 100 if supabase_total > 0 else 0
        print(f"  📊 Sync coverage: {sync_percentage:.1f}%")
    
    # Check for records with legacy_book_id in Supabase
    response2 = requests.get(
        'https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies',
        headers=headers,
        params={
            'select': 'count',
            'legacy_book_id': 'not.is.null'
        }
    )
    
    if response2.status_code == 200:
        supabase_with_legacy = response2.json()[0]['count']
        print(f"  🏷️ With legacy_book_id in Supabase: {supabase_with_legacy}")
        
        # Calculate expected coverage
        expected_with_legacy = min(total_local, supabase_with_legacy)
        legacy_coverage = (with_legacy / expected_with_legacy) * 100 if expected_with_legacy > 0 else 0
        print(f"  📊 Legacy ID coverage: {legacy_coverage:.1f}%")
    
    print("\\n" + "="*50)
    
    if missing_legacy == 0:
        print("✅ PERFECT! All local records have legacy_book_id")
    elif missing_legacy <= 100:
        print(f"✅ GOOD! Only {missing_legacy} records missing legacy_book_id")
        print("   This is likely due to new records in Supabase without legacy_book_id")
    else:
        print(f"⚠️ WARNING: {missing_legacy} records missing legacy_book_id")
        print("   Consider running the sync again")
    
    print("\\n📋 Recommended actions:")
    if missing_legacy > 0:
        print("  1. Run 'Sync Book Copies' from the application")
        print("  2. This should update any records missing legacy_book_id")
    
    print("  3. Verify that the sync logic uses INSERT OR REPLACE")
    print("  4. Ensure all existing records get updated with legacy_book_id")
    
    # Show sample records without legacy_book_id
    if missing_legacy > 0:
        print("\\n📝 Sample records without legacy_book_id:")
        cursor.execute("SELECT id, copy_identifier, created_at FROM book_copies WHERE legacy_book_id IS NULL OR legacy_book_id = 0 LIMIT 5")
        for row in cursor.fetchall():
            print(f"  ID: {row[0][:8]}..., Copy: {row[1]}, Created: {row[2]}")
    
    conn.close()

if __name__ == "__main__":
    main()
