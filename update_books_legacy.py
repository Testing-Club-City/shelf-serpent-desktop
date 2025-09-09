#!/usr/bin/env python3
"""
Update books table with legacy IDs
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
    
    # Update books with legacy IDs from Supabase
    print("\n📡 Fetching books with legacy IDs...")
    url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books"
    headers = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    }
    
    # Get books in batches
    offset = 0
    batch_size = 100
    total_updated = 0
    
    while True:
        response = requests.get(url, headers=headers, params={
            "select": "id,legacy_book_id,legacy_isbn,title",
            "limit": batch_size,
            "offset": offset
        })
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch: {response.status_code}")
            break
            
        books = response.json()
        if not books:
            break
            
        print(f"📥 Processing {len(books)} books (offset: {offset})")
        
        for book in books:
            book_id = book.get('id')
            legacy_book_id = book.get('legacy_book_id')
            legacy_isbn = book.get('legacy_isbn')
            title = book.get('title', 'Unknown')
            
            if legacy_book_id or legacy_isbn:
                cursor.execute("""
                    UPDATE books 
                    SET legacy_book_id = ?, legacy_isbn = ?
                    WHERE id = ? AND (legacy_book_id IS NULL OR legacy_isbn IS NULL)
                """, (legacy_book_id, legacy_isbn, book_id))
                
                if cursor.rowcount > 0:
                    total_updated += 1
        
        conn.commit()
        offset += batch_size
    
    print(f"✅ Updated {total_updated} books with legacy IDs")
    
    # Final verification
    print("\n🔍 Final verification:")
    cursor.execute("SELECT COUNT(*) FROM books WHERE legacy_book_id IS NOT NULL")
    books_with_legacy = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL")
    copies_with_legacy = cursor.fetchone()[0]
    
    print(f"📚 Books with legacy_book_id: {books_with_legacy}")
    print(f"📖 Book copies with legacy_book_id: {copies_with_legacy}")
    
    # Show samples
    print("\n📋 Sample books with legacy IDs:")
    cursor.execute("SELECT title, legacy_book_id, legacy_isbn FROM books WHERE legacy_book_id IS NOT NULL LIMIT 5")
    for row in cursor.fetchall():
        print(f"  {row[0]} -> legacy_book_id: {row[1]}, legacy_isbn: {row[2]}")
    
    conn.close()

if __name__ == "__main__":
    main()
