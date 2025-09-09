#!/usr/bin/env python3
"""
Check book_copies table structure and data for legacy_book_id 346
"""

import sqlite3
from pathlib import Path
import os

def main():
    db_path = Path(os.environ.get('APPDATA', '')) / 'library-management-system' / 'library.db'
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    print('🔍 Checking the book_copies table structure and data...')

    # Check the structure first
    cursor.execute('PRAGMA table_info(book_copies)')
    columns = cursor.fetchall()
    print('📋 Book_copies table columns:')
    for col in columns:
        print(f'  - {col[1]}: {col[2]}')

    print('\n🔍 Checking sample data for legacy_book_id = 346...')
    cursor.execute('SELECT * FROM book_copies WHERE legacy_book_id = 346 LIMIT 1')
    result = cursor.fetchone()
    if result:
        print('📊 Sample record:')
        for i, col in enumerate(columns):
            value = result[i] if i < len(result) else 'N/A'
            print(f'  {col[1]}: {value}')
    else:
        print('❌ No record found with legacy_book_id = 346')
        
    print('\n🔍 Let\'s also check if there\'s a separate books table...')
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%book%'")
    book_tables = cursor.fetchall()
    print('📚 Book-related tables:')
    for table in book_tables:
        print(f'  - {table[0]}')
        
    # If there's a books table, check if it has better author info
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='books'")
    books_table = cursor.fetchone()
    if books_table:
        print('\n📖 Checking books table structure...')
        cursor.execute('PRAGMA table_info(books)')
        books_columns = cursor.fetchall()
        for col in books_columns:
            print(f'  - {col[1]}: {col[2]}')
            
        print('\n🔍 Checking for books with legacy_book_id...')
        cursor.execute('SELECT COUNT(*) FROM books WHERE legacy_book_id IS NOT NULL')
        count = cursor.fetchone()[0]
        print(f'📊 Books with legacy_book_id: {count}')
        
        if count > 0:
            cursor.execute('SELECT title, author, legacy_book_id FROM books WHERE legacy_book_id IS NOT NULL LIMIT 3')
            print('📋 Sample books with legacy_book_id:')
            for row in cursor.fetchall():
                print(f'  Title: {row[0]}, Author: {row[1]}, Legacy ID: {row[2]}')

    conn.close()

if __name__ == "__main__":
    main()
