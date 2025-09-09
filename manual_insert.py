#!/usr/bin/env python3
"""
Manual insert script to bypass SQLite constraints and insert legacy book IDs
"""

import sqlite3
import requests
import os
from pathlib import Path
from datetime import datetime

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
    
    # Drop and recreate book_copies table with simplified schema to avoid constraints
    print("\n🔄 Recreating book_copies table...")
    cursor.execute("DROP TABLE IF EXISTS book_copies")
    cursor.execute("""
        CREATE TABLE book_copies (
            id BIGINT PRIMARY KEY,
            isbn TEXT,
            title TEXT,
            author TEXT,
            publisher TEXT,
            publication_year INTEGER,
            copy_identifier TEXT,
            acquisition_date TEXT,
            condition TEXT,
            status TEXT,
            location TEXT,
            department_id INTEGER,
            current_borrower_id TEXT,
            borrowed_at TEXT,
            due_date TEXT,
            legacy_book_id INTEGER,
            created_at TEXT,
            updated_at TEXT,
            synced INTEGER DEFAULT 0,
            sync_version INTEGER DEFAULT 1,
            deleted INTEGER DEFAULT 0
        )
    """)
    
    # Fetch book copies from Supabase
    print("\n📡 Fetching book copies from Supabase...")
    url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies"
    headers = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    }
    
    # Get book copies in batches
    total_inserted = 0
    offset = 0
    batch_size = 100
    
    while True:
        response = requests.get(url, headers=headers, params={
            "select": "id,legacy_book_id,book_code,tracking_code,condition,status",
            "limit": batch_size,
            "offset": offset
        })
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch: {response.status_code}")
            break
            
        data = response.json()
        if not data:
            break
            
        print(f"📥 Processing {len(data)} records (offset: {offset})")
        
        for copy in data:
            copy_id = copy.get('id')
            legacy_book_id = copy.get('legacy_book_id')
            book_code = copy.get('book_code', '')
            tracking_code = copy.get('tracking_code', f'COPY-{copy_id}')
            condition = copy.get('condition', 'good')
            status = copy.get('status', 'available')
            
            # Insert with current timestamp
            now = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO book_copies (
                    id, isbn, title, author, publisher, copy_identifier,
                    acquisition_date, condition, status, legacy_book_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                copy_id,
                book_code,
                f'Book {copy_id}',
                'Unknown Author',
                '',
                tracking_code,
                now,
                condition,
                status,
                legacy_book_id,
                now,
                now
            ))
            
            total_inserted += 1
        
        offset += batch_size
        conn.commit()
    
    print(f"✅ Inserted {total_inserted} book copies")
    
    # Update books with legacy IDs
    print("\n📡 Updating books with legacy IDs...")
    url2 = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books"
    response2 = requests.get(url2, headers=headers, params={
        "select": "id,legacy_book_id,legacy_isbn,title",
        "limit": 1000
    })
    
    if response2.status_code == 200:
        books = response2.json()
        updated = 0
        
        for book in books:
            book_id = book.get('id')
            legacy_book_id = book.get('legacy_book_id')
            legacy_isbn = book.get('legacy_isbn')
            
            if legacy_book_id or legacy_isbn:
                cursor.execute("""
                    UPDATE books 
                    SET legacy_book_id = ?, legacy_isbn = ?
                    WHERE id = ?
                """, (legacy_book_id, legacy_isbn, book_id))
                
                if cursor.rowcount > 0:
                    updated += 1
        
        conn.commit()
        print(f"✅ Updated {updated} books with legacy IDs")
    
    # Final verification
    print("\n🔍 Final verification:")
    cursor.execute("SELECT COUNT(*) FROM books WHERE legacy_book_id IS NOT NULL")
    books_with_legacy = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL")
    copies_with_legacy = cursor.fetchone()[0]
    
    print(f"📚 Books with legacy_book_id: {books_with_legacy}")
    print(f"📖 Book copies with legacy_book_id: {copies_with_legacy}")
    
    # Show samples
    print("\n📋 Sample book copies with legacy IDs:")
    cursor.execute("SELECT id, copy_identifier, legacy_book_id FROM book_copies WHERE legacy_book_id IS NOT NULL LIMIT 5")
    for row in cursor.fetchall():
        print(f"  Copy {row[0]} ({row[1]}) -> legacy_book_id: {row[2]}")
    
    conn.close()

if __name__ == "__main__":
    main()
