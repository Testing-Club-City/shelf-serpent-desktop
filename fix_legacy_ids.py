#!/usr/bin/env python3
"""
Targeted script to fix legacy_book_id sync issues
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
    
    # Fetch books with legacy IDs from Supabase
    print("\n📡 Fetching books with legacy IDs from Supabase...")
    url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books"
    headers = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    }
    
    # Get books with actual legacy IDs
    response = requests.get(url, headers=headers, params={
        "select": "id,legacy_book_id,legacy_isbn,title",
        "limit": 50
    })
    
    if response.status_code == 200:
        books = response.json()
        print(f"✅ Found {len(books)} books")
        
        updated = 0
        for book in books:
            book_id = book.get('id')
            legacy_book_id = book.get('legacy_book_id')
            legacy_isbn = book.get('legacy_isbn')
            title = book.get('title', 'Unknown')
            
            if legacy_book_id or legacy_isbn:
                cursor.execute("""
                    UPDATE books 
                    SET legacy_book_id = ?, legacy_isbn = ?
                    WHERE id = ?
                """, (legacy_book_id, legacy_isbn, book_id))
                
                if cursor.rowcount > 0:
                    print(f"📚 Updated '{title}': legacy_book_id={legacy_book_id}, legacy_isbn={legacy_isbn}")
                    updated += 1
        
        conn.commit()
        print(f"✅ Updated {updated} books with legacy IDs")
    
    # Fetch book copies with legacy IDs
    print("\n📡 Fetching book copies with legacy IDs...")
    url2 = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies"
    response2 = requests.get(url2, headers=headers, params={
        "select": "id,legacy_book_id,book_code,tracking_code",
        "limit": 50
    })
    
    if response2.status_code == 200:
        copies = response2.json()
        print(f"✅ Found {len(copies)} book copies")
        
        updated = 0
        for copy in copies:
            copy_id = copy.get('id')
            legacy_book_id = copy.get('legacy_book_id')
            
            if legacy_book_id:
                cursor.execute("""
                    UPDATE book_copies 
                    SET legacy_book_id = ?
                    WHERE id = ?
                """, (legacy_book_id, copy_id))
                
                if cursor.rowcount > 0:
                    print(f"📖 Updated copy {copy_id}: legacy_book_id={legacy_book_id}")
                    updated += 1
        
        conn.commit()
        print(f"✅ Updated {updated} book copies with legacy IDs")
    
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
    cursor.execute("SELECT id, title, legacy_book_id, legacy_isbn FROM books WHERE legacy_book_id IS NOT NULL LIMIT 5")
    for row in cursor.fetchall():
        print(f"  {row[1]} -> legacy_book_id: {row[2]}, legacy_isbn: {row[3]}")
    
    conn.close()

if __name__ == "__main__":
    main()
