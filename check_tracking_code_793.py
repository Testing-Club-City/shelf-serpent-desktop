#!/usr/bin/env python3
"""
Check if tracking code 793 exists in the database
"""

import sqlite3
from pathlib import Path

def check_tracking_code_793():
    """Check if tracking code 793 exists in the database"""
    
    db_path = Path.home() / "AppData/Roaming/library-management-system/library.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"🔍 CHECKING TRACKING CODE 793 IN DATABASE")
    print(f"Database: {db_path}")
    print("=" * 80)
    
    try:
        # Connect to database
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Search for tracking code 793
        cursor.execute("""
            SELECT 
                bc.id, bc.book_id, bc.tracking_code, bc.copy_number, bc.status, bc.condition,
                b.id as book_id, b.title, b.author, b.isbn, b.book_code
            FROM book_copies bc
            JOIN books b ON bc.book_id = b.id
            WHERE bc.tracking_code = ?
        """, ("793",))
        
        result = cursor.fetchone()
        
        if result:
            print(f"✅ FOUND TRACKING CODE 793:")
            print(f"   Book Copy ID: {result['id']}")
            print(f"   Book ID: {result['book_id']}")
            print(f"   Tracking Code: {result['tracking_code']}")
            print(f"   Copy Number: {result['copy_number']}")
            print(f"   Status: {result['status']}")
            print(f"   Condition: {result['condition']}")
            print(f"   Book Title: {result['title']}")
            print(f"   Book Author: {result['author']}")
            print(f"   Book Code: {result['book_code']}")
            print(f"   ISBN: {result['isbn']}")
        else:
            print(f"❌ NO TRACKING CODE 793 FOUND")
            
            # Check if there are any tracking codes at all
            cursor.execute("SELECT COUNT(*) as count FROM book_copies WHERE tracking_code IS NOT NULL")
            tracking_count = cursor.fetchone()['count']
            print(f"\n📊 Total book copies with tracking codes: {tracking_count}")
            
            # Show some sample tracking codes
            cursor.execute("""
                SELECT tracking_code, b.title, b.author
                FROM book_copies bc
                JOIN books b ON bc.book_id = b.id
                WHERE bc.tracking_code IS NOT NULL
                LIMIT 10
            """)
            
            samples = cursor.fetchall()
            if samples:
                print(f"\n📚 Sample tracking codes in database:")
                for sample in samples:
                    print(f"   {sample['tracking_code']}: '{sample['title']}' by {sample['author']}")
        
        # Also check if there's a book with book_code = 793
        cursor.execute("""
            SELECT id, title, author, book_code, isbn
            FROM books
            WHERE book_code = ?
        """, ("793",))
        
        book_result = cursor.fetchone()
        
        if book_result:
            print(f"\n📖 FOUND BOOK WITH BOOK_CODE 793:")
            print(f"   Book ID: {book_result['id']}")
            print(f"   Title: {book_result['title']}")
            print(f"   Author: {book_result['author']}")
            print(f"   Book Code: {book_result['book_code']}")
            print(f"   ISBN: {book_result['isbn']}")
        else:
            print(f"\n❌ NO BOOK WITH BOOK_CODE 793 FOUND")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    check_tracking_code_793()