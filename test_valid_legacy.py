#!/usr/bin/env python3
"""
Test script to find a valid legacy book ID for testing
"""

import sqlite3
from pathlib import Path
import os

def main():
    db_path = Path(os.environ.get('APPDATA', '')) / 'library-management-system' / 'library.db'
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    print('🧪 Testing the search functionality...')

    # Get a valid legacy_book_id to test
    cursor.execute('SELECT legacy_book_id, copy_identifier, status FROM book_copies WHERE legacy_book_id IS NOT NULL AND status = "available" LIMIT 1')
    test_record = cursor.fetchone()

    if test_record:
        legacy_id, copy_id, status = test_record
        print(f'✅ Found test record: legacy_book_id={legacy_id}, copy={copy_id}, status={status}')
        print(f'📝 You can now test with legacy_book_id: {legacy_id}')
        
        # Test a few more valid IDs
        print('\n📋 Additional test legacy_book_ids:')
        cursor.execute('SELECT legacy_book_id, copy_identifier FROM book_copies WHERE legacy_book_id IS NOT NULL AND status = "available" LIMIT 5')
        for row in cursor.fetchall():
            print(f'  - Legacy ID: {row[0]} (Copy: {row[1]})')
            
    else:
        print('❌ No available book copies with legacy_book_id found')

    conn.close()

if __name__ == "__main__":
    main()
