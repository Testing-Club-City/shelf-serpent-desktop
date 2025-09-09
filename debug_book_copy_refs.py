#!/usr/bin/env python3
"""
Debug book_copy_id references in borrowings
"""

import sqlite3
from pathlib import Path

def debug_book_copy_refs():
    """Debug the book_copy_id references issue"""
    
    db_path = Path.home() / "AppData/Roaming/library-management-system/library.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"🔍 DEBUGGING BOOK_COPY_ID REFERENCES")
    print(f"Database: {db_path}")
    print("=" * 80)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. Check book_copy_id values in borrowings
        print(f"\n📋 BOOK_COPY_ID ANALYSIS:")
        
        cursor.execute("SELECT COUNT(*) as count FROM borrowings WHERE book_copy_id IS NULL")
        null_copy_ids = cursor.fetchone()['count']
        print(f"   Borrowings with NULL book_copy_id: {null_copy_ids}")
        
        cursor.execute("SELECT COUNT(*) as count FROM borrowings WHERE book_copy_id = ''")
        empty_copy_ids = cursor.fetchone()['count']
        print(f"   Borrowings with empty book_copy_id: {empty_copy_ids}")
        
        cursor.execute("SELECT COUNT(*) as count FROM borrowings WHERE book_copy_id IS NOT NULL AND book_copy_id != ''")
        valid_copy_ids = cursor.fetchone()['count']
        print(f"   Borrowings with valid book_copy_id: {valid_copy_ids}")
        
        # 2. Sample borrowings with missing book_copy_id
        print(f"\n📝 SAMPLE BORROWINGS WITH MISSING BOOK_COPY_ID:")
        cursor.execute("""
            SELECT id, student_id, book_id, book_copy_id, status, borrowed_date 
            FROM borrowings 
            WHERE book_copy_id IS NULL OR book_copy_id = ''
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        missing_samples = cursor.fetchall()
        for i, row in enumerate(missing_samples):
            print(f"   --- Missing {i+1} ---")
            print(f"   ID: {row['id']}")
            print(f"   Student ID: {row['student_id']}")
            print(f"   Book ID: {row['book_id']}")
            print(f"   Book Copy ID: '{row['book_copy_id']}'")
            print(f"   Status: {row['status']}")
            print(f"   Borrowed: {row['borrowed_date']}")
        
        # 3. Sample borrowings with valid book_copy_id
        print(f"\n📝 SAMPLE BORROWINGS WITH VALID BOOK_COPY_ID:")
        cursor.execute("""
            SELECT id, student_id, book_id, book_copy_id, status, borrowed_date 
            FROM borrowings 
            WHERE book_copy_id IS NOT NULL AND book_copy_id != ''
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        valid_samples = cursor.fetchall()
        for i, row in enumerate(valid_samples):
            print(f"   --- Valid {i+1} ---")
            print(f"   ID: {row['id']}")
            print(f"   Student ID: {row['student_id']}")
            print(f"   Book ID: {row['book_id']}")
            print(f"   Book Copy ID: '{row['book_copy_id']}'")
            print(f"   Status: {row['status']}")
            print(f"   Borrowed: {row['borrowed_date']}")
        
        # 4. Check if book_id can be used to find book_copies
        print(f"\n🔍 CHECKING BOOK_ID TO BOOK_COPIES RELATIONSHIP:")
        
        # Sample a borrowing with missing book_copy_id but has book_id
        cursor.execute("""
            SELECT book_id 
            FROM borrowings 
            WHERE (book_copy_id IS NULL OR book_copy_id = '') 
            AND book_id IS NOT NULL 
            LIMIT 1
        """)
        sample_book_id = cursor.fetchone()
        
        if sample_book_id:
            book_id = sample_book_id['book_id']
            print(f"   Sample book_id: {book_id}")
            
            # Check if there are book_copies with this book_id reference
            cursor.execute("SELECT COUNT(*) as count FROM book_copies WHERE legacy_book_id = ?", (book_id,))
            matching_copies = cursor.fetchone()['count']
            print(f"   Book copies with legacy_book_id = {book_id}: {matching_copies}")
            
            if matching_copies > 0:
                cursor.execute("SELECT id, title, author FROM book_copies WHERE legacy_book_id = ? LIMIT 3", (book_id,))
                copies = cursor.fetchall()
                print(f"   Sample matching copies:")
                for copy in copies:
                    print(f"     - ID: {copy['id']}, Title: '{copy['title']}', Author: '{copy['author']}'")
        
        # 5. Check the relationship between books and book_copies tables
        print(f"\n🔗 BOOKS TO BOOK_COPIES RELATIONSHIP:")
        
        cursor.execute("SELECT COUNT(*) as count FROM books")
        total_books = cursor.fetchone()['count']
        print(f"   Total books: {total_books}")
        
        cursor.execute("SELECT COUNT(DISTINCT legacy_book_id) as count FROM book_copies WHERE legacy_book_id IS NOT NULL")
        books_with_copies = cursor.fetchone()['count']
        print(f"   Books that have copies: {books_with_copies}")
        
        # 6. Test a modified query that uses book_id instead of book_copy_id
        print(f"\n🔍 TESTING MODIFIED QUERY (using book_id via legacy_book_id):")
        modified_query = """
            SELECT 
                b.id, b.status, b.borrower_type,
                s.first_name as student_first_name, s.last_name as student_last_name,
                bc.title as book_title, bc.author as book_author
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id AND s.deleted = 0
            LEFT JOIN book_copies bc ON b.book_id = bc.legacy_book_id AND bc.deleted = 0
            WHERE b.deleted = 0 AND b.status = 'active'
            ORDER BY b.created_at DESC
            LIMIT 5
        """
        
        try:
            cursor.execute(modified_query)
            modified_results = cursor.fetchall()
            print(f"   Modified query returned: {len(modified_results)} results")
            
            for i, row in enumerate(modified_results):
                print(f"   --- Result {i+1} ---")
                print(f"   ID: {row['id']}")
                print(f"   Status: {row['status']}")
                print(f"   Student: {row['student_first_name']} {row['student_last_name']}")
                print(f"   Book: '{row['book_title']}' by {row['book_author']}")
                
        except Exception as e:
            print(f"   ❌ Modified query failed: {e}")
        
        conn.close()
        
        print(f"\n💡 ROOT CAUSE IDENTIFIED:")
        print(f"   ❌ Most borrowings ({null_copy_ids + empty_copy_ids}) have missing book_copy_id")
        print(f"   ✅ Only {valid_copy_ids} borrowings have valid book_copy_id references")
        print(f"   🔍 The borrowings were created with book_id but not book_copy_id")
        print(f"   🔍 Need to either:")
        print(f"      1. Fix the borrowing creation process to set book_copy_id")
        print(f"      2. Modify the query to use book_id -> legacy_book_id relationship")
        print(f"      3. Update existing borrowings to set proper book_copy_id values")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_book_copy_refs()