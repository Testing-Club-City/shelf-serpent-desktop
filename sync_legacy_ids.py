#!/usr/bin/env python3
"""
Legacy Book ID Sync Script
Pulls legacy_book_id and legacy_isbn from Supabase and inserts into local SQLite database.
"""

import sqlite3
import requests
import json
import os
from pathlib import Path
from typing import Dict, List, Optional

# Supabase configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def get_local_db_path() -> Path:
    """Get the local SQLite database path."""
    if os.name == 'nt':  # Windows
        data_dir = Path(os.environ.get('APPDATA', '')) / 'library-management-system'
    else:  # Unix-like
        data_dir = Path.home() / '.local' / 'share' / 'library-management-system'
    
    return data_dir / 'library.db'

def fetch_supabase_data(table: str, select_fields: str = "*", limit: int = 1000) -> List[Dict]:
    """Fetch data from Supabase table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }
    
    params = {
        "select": select_fields,
        "limit": limit
    }
    
    print(f"📡 Fetching {table} from Supabase...")
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Fetched {len(data)} records from {table}")
        return data
    else:
        print(f"❌ Failed to fetch {table}: {response.status_code} - {response.text}")
        return []

def sync_books_legacy_ids(conn: sqlite3.Connection) -> int:
    """Sync legacy book IDs for books table."""
    print("\n🔄 Syncing books legacy IDs...")
    
    # Fetch books with legacy fields from Supabase
    books = fetch_supabase_data("books", "id,legacy_book_id,legacy_isbn,title,isbn")
    
    if not books:
        print("⚠️ No books found in Supabase")
        return 0
    
    updated_count = 0
    cursor = conn.cursor()
    
    for book in books:
        book_id = book.get('id')
        legacy_book_id = book.get('legacy_book_id')
        legacy_isbn = book.get('legacy_isbn')
        title = book.get('title', 'Unknown')
        
        if not book_id:
            continue
            
        # Check if book exists locally
        cursor.execute("SELECT id FROM books WHERE id = ?", (book_id,))
        if cursor.fetchone():
            # Update existing book with legacy fields
            cursor.execute("""
                UPDATE books 
                SET legacy_book_id = ?, legacy_isbn = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (legacy_book_id, legacy_isbn, book_id))
            
            if legacy_book_id or legacy_isbn:
                print(f"📚 Updated book '{title}' with legacy_book_id={legacy_book_id}, legacy_isbn={legacy_isbn}")
                updated_count += 1
        else:
            # Insert new book with basic info and legacy fields
            cursor.execute("""
                INSERT OR IGNORE INTO books (
                    id, title, author, isbn, legacy_book_id, legacy_isbn,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                book_id, 
                title, 
                book.get('author', 'Unknown'),
                book.get('isbn', ''),
                legacy_book_id,
                legacy_isbn
            ))
            
            if cursor.rowcount > 0:
                print(f"📚 Inserted new book '{title}' with legacy_book_id={legacy_book_id}")
                updated_count += 1
    
    conn.commit()
    print(f"✅ Updated {updated_count} books with legacy IDs")
    return updated_count

def sync_book_copies_legacy_ids(conn: sqlite3.Connection) -> int:
    """Sync legacy book IDs for book_copies table."""
    print("\n🔄 Syncing book copies legacy IDs...")
    
    # Fetch book copies with legacy fields from Supabase - use actual column names
    book_copies = fetch_supabase_data("book_copies", "id,legacy_book_id,book_code,tracking_code,condition,status")
    
    if not book_copies:
        print("⚠️ No book copies found in Supabase")
        return 0
    
    updated_count = 0
    cursor = conn.cursor()
    
    for copy in book_copies:
        copy_id = copy.get('id')
        legacy_book_id = copy.get('legacy_book_id')
        book_code = copy.get('book_code', '')
        tracking_code = copy.get('tracking_code', f'COPY-{copy_id}')
        
        if not copy_id:
            continue
            
        # Check if book copy exists locally
        cursor.execute("SELECT id FROM book_copies WHERE id = ?", (copy_id,))
        if cursor.fetchone():
            # Update existing book copy with legacy_book_id
            cursor.execute("""
                UPDATE book_copies 
                SET legacy_book_id = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (legacy_book_id, copy_id))
            
            if legacy_book_id:
                print(f"📖 Updated copy '{tracking_code}' (ID: {copy_id}) with legacy_book_id={legacy_book_id}")
                updated_count += 1
        else:
            # Insert new book copy with legacy_book_id - minimal required fields
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO book_copies (
                        id, isbn, title, author, copy_identifier,
                        legacy_book_id, condition, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (
                    copy_id,
                    book_code or '',  # Map book_code to isbn
                    f'Book Copy {copy_id}',  # placeholder title
                    'Unknown Author',  # placeholder author
                    tracking_code or f'COPY-{copy_id}',  # Map tracking_code to copy_identifier
                    legacy_book_id,
                    copy.get('condition', 'good') or 'good',
                    copy.get('status', 'available') or 'available'
                ))
            except sqlite3.IntegrityError as e:
                print(f"⚠️ Skipping copy {copy_id} due to constraint: {e}")
                continue
            
            if cursor.rowcount > 0:
                print(f"📖 Inserted new copy '{tracking_code}' with legacy_book_id={legacy_book_id}")
                updated_count += 1
    
    conn.commit()
    print(f"✅ Updated {updated_count} book copies with legacy IDs")
    return updated_count

def verify_legacy_ids(conn: sqlite3.Connection):
    """Verify that legacy IDs were inserted correctly."""
    print("\n🔍 Verifying legacy IDs...")
    
    cursor = conn.cursor()
    
    # Check books
    cursor.execute("SELECT COUNT(*) FROM books WHERE legacy_book_id IS NOT NULL")
    books_with_legacy = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM books WHERE legacy_isbn IS NOT NULL")
    books_with_legacy_isbn = cursor.fetchone()[0]
    
    print(f"📚 Books with legacy_book_id: {books_with_legacy}")
    print(f"📚 Books with legacy_isbn: {books_with_legacy_isbn}")
    
    # Check book copies
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL")
    copies_with_legacy = cursor.fetchone()[0]
    
    print(f"📖 Book copies with legacy_book_id: {copies_with_legacy}")
    
    # Show some examples
    print("\n📋 Sample books with legacy IDs:")
    cursor.execute("""
        SELECT id, title, legacy_book_id, legacy_isbn 
        FROM books 
        WHERE legacy_book_id IS NOT NULL 
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        book_id, title, legacy_book_id, legacy_isbn = row
        print(f"  • {title} (ID: {book_id}) -> legacy_book_id: {legacy_book_id}, legacy_isbn: {legacy_isbn}")
    
    print("\n📋 Sample book copies with legacy IDs:")
    cursor.execute("""
        SELECT id, title, legacy_book_id 
        FROM book_copies 
        WHERE legacy_book_id IS NOT NULL 
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        copy_id, title, legacy_book_id = row
        print(f"  • {title} (Copy ID: {copy_id}) -> legacy_book_id: {legacy_book_id}")

def main():
    """Main sync function."""
    print("🚀 Starting Legacy Book ID Sync")
    print("=" * 50)
    
    # Get database path
    db_path = get_local_db_path()
    print(f"📁 Database path: {db_path}")
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        print("Please run the Tauri app first to create the database.")
        return
    
    # Connect to database
    try:
        conn = sqlite3.connect(str(db_path))
        conn.execute("PRAGMA foreign_keys = OFF")
        print("✅ Connected to local database")
        
        # Check if legacy_book_id column exists in book_copies
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(book_copies)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'legacy_book_id' not in columns:
            print("❌ legacy_book_id column not found in book_copies table")
            print("Please run the migration first: cargo run --bin run-migration")
            return
        
        print("✅ legacy_book_id column found in book_copies table")
        
        # Sync legacy IDs
        books_updated = sync_books_legacy_ids(conn)
        copies_updated = sync_book_copies_legacy_ids(conn)
        
        # Verify results
        verify_legacy_ids(conn)
        
        print("\n" + "=" * 50)
        print("🎉 Legacy ID sync completed!")
        print(f"📚 Books updated: {books_updated}")
        print(f"📖 Book copies updated: {copies_updated}")
        print(f"📊 Total records updated: {books_updated + copies_updated}")
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except requests.RequestException as e:
        print(f"❌ Network error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            print("🔐 Database connection closed")

if __name__ == "__main__":
    main()
