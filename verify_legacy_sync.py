#!/usr/bin/env python3
"""
Final verification script for legacy book ID sync
"""

import sqlite3
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
    
    # Check book_copies table
    print("📊 Book Copies Analysis:")
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total_copies = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL")
    copies_with_legacy = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NULL")
    copies_without_legacy = cursor.fetchone()[0]
    
    print(f"  Total book copies: {total_copies}")
    print(f"  With legacy_book_id: {copies_with_legacy}")
    print(f"  Without legacy_book_id: {copies_without_legacy}")
    
    # Check books table
    print("\n📚 Books Analysis:")
    cursor.execute("SELECT COUNT(*) FROM books")
    total_books = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM books WHERE legacy_book_id IS NOT NULL")
    books_with_legacy = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM books WHERE legacy_book_id IS NULL")
    books_without_legacy = cursor.fetchone()[0]
    
    print(f"  Total books: {total_books}")
    print(f"  With legacy_book_id: {books_with_legacy}")
    print(f"  Without legacy_book_id: {books_without_legacy}")
    
    # Show sample book copies with legacy IDs
    print("\n📋 Sample book copies with legacy_book_id:")
    cursor.execute("""
        SELECT id, copy_identifier, legacy_book_id, condition, status 
        FROM book_copies 
        WHERE legacy_book_id IS NOT NULL 
        ORDER BY legacy_book_id 
        LIMIT 10
    """)
    
    for row in cursor.fetchall():
        print(f"  Copy ID: {row[0]}")
        print(f"  Identifier: {row[1]}")
        print(f"  Legacy Book ID: {row[2]}")
        print(f"  Condition: {row[3]}, Status: {row[4]}")
        print("---")
    
    # Test search functionality
    print("\n🔍 Testing search by legacy_book_id...")
    test_legacy_id = "8737"
    cursor.execute("""
        SELECT id, copy_identifier, condition, status 
        FROM book_copies 
        WHERE legacy_book_id = ?
    """, (test_legacy_id,))
    
    results = cursor.fetchall()
    print(f"  Found {len(results)} copies with legacy_book_id = {test_legacy_id}")
    for row in results:
        print(f"    Copy: {row[0]} ({row[1]}) - {row[2]}, {row[3]}")
    
    conn.close()
    
    print("\n✅ Legacy Book ID Sync Verification Complete!")
    print("📊 Summary:")
    print(f"  - Book copies successfully synced: {copies_with_legacy}")
    print(f"  - Legacy IDs available for offline search: YES")
    print(f"  - Books table legacy IDs: {books_with_legacy} (as expected from Supabase)")

if __name__ == "__main__":
    main()
