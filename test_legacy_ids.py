#!/usr/bin/env python3
"""
Test script to check available legacy book IDs
"""

import sqlite3
from pathlib import Path
import os

def main():
    db_path = Path(os.environ.get('APPDATA', '')) / 'library-management-system' / 'library.db'
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    print('🔍 Sample legacy book IDs in your local database:')
    cursor.execute('SELECT legacy_book_id, title, available_copies FROM books WHERE legacy_book_id IS NOT NULL ORDER BY legacy_book_id LIMIT 10')
    for row in cursor.fetchall():
        print(f'  Legacy ID {row[0]}: "{row[1]}" (Available: {row[2]})')

    print('\n🔍 Searching for legacy book IDs containing "467":')
    cursor.execute('SELECT legacy_book_id, title, available_copies FROM books WHERE legacy_book_id IS NOT NULL AND CAST(legacy_book_id AS TEXT) LIKE "%467%" ORDER BY legacy_book_id')
    results = cursor.fetchall()
    if results:
        for row in results:
            print(f'  Legacy ID {row[0]}: "{row[1]}" (Available: {row[2]})')
    else:
        print('  No legacy book IDs containing "467" found')

    print('\n📊 Total books with legacy_book_id:')
    cursor.execute('SELECT COUNT(*) FROM books WHERE legacy_book_id IS NOT NULL')
    total = cursor.fetchone()[0]
    print(f'  {total} books have legacy_book_id values')

    print('\n🎯 Test with a few specific legacy IDs:')
    test_ids = [8737, 2426, 7309, 2416, 11506]  # From our earlier verification
    for test_id in test_ids:
        cursor.execute('SELECT title, available_copies FROM books WHERE legacy_book_id = ?', (test_id,))
        result = cursor.fetchone()
        if result:
            print(f'  ✅ Legacy ID {test_id}: "{result[0]}" (Available: {result[1]})')
        else:
            print(f'  ❌ Legacy ID {test_id}: Not found in books table')

    conn.close()

if __name__ == "__main__":
    main()
