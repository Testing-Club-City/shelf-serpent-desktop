#!/usr/bin/env python3
"""
Check records that are missing legacy_book_id
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
    
    print('📊 Records without legacy_book_id:')
    cursor.execute('SELECT id, isbn, copy_identifier, created_at FROM book_copies WHERE legacy_book_id IS NULL LIMIT 10')
    for row in cursor.fetchall():
        print(f'  ID: {row[0]}, ISBN: {row[1]}, Copy: {row[2]}, Created: {row[3]}')
    
    print('\n🔍 Checking if these records exist in Supabase...')
    cursor.execute('SELECT id FROM book_copies WHERE legacy_book_id IS NULL LIMIT 5')
    missing_ids = [row[0] for row in cursor.fetchall()]
    
    headers = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'
    }
    
    for missing_id in missing_ids:
        response = requests.get(
            'https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies',
            headers=headers,
            params={'select': 'id,legacy_book_id', 'id': f'eq.{missing_id}'}
        )
        if response.status_code == 200:
            data = response.json()
            if data:
                legacy_id = data[0].get('legacy_book_id')
                print(f'  ✅ Found in Supabase: ID={missing_id}, Legacy={legacy_id}')
            else:
                print(f'  ❌ Not found in Supabase: ID={missing_id}')
        else:
            print(f'  ❌ Error fetching ID={missing_id}: {response.status_code}')
    
    conn.close()

if __name__ == "__main__":
    main()
