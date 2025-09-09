#!/usr/bin/env python3
"""
Debug script to check and manually insert legacy book IDs
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
    
    # Check current schema
    print("\n📋 Current book_copies schema:")
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(book_copies)")
    for row in cursor.fetchall():
        print(f"  {row[1]}: {row[2]}")
    
    # Check current counts
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total = cursor.fetchone()[0]
    print(f"\n📊 Total book copies: {total}")
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL")
    with_legacy = cursor.fetchone()[0]
    print(f"📊 Book copies with legacy_book_id: {with_legacy}")
    
    # Show sample data
    print("\n📋 Sample book copies:")
    cursor.execute("SELECT id, isbn, copy_identifier, legacy_book_id FROM book_copies LIMIT 5")
    for row in cursor.fetchall():
        print(f"  ID: {row[0]}, ISBN: {row[1]}, Copy: {row[2]}, Legacy: {row[3]}")
    
    # Fetch from Supabase
    print("\n📡 Fetching from Supabase...")
    url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies"
    headers = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    }
    
    response = requests.get(url, headers=headers, params={"limit": 5})
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Found {len(data)} book copies in Supabase")
        for item in data:
            print(f"  ID: {item.get('id')}, Legacy: {item.get('legacy_book_id')}, Code: {item.get('book_code')}")
    
    conn.close()

if __name__ == "__main__":
    main()
