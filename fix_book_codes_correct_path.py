#!/usr/bin/env python3
"""
Fix book codes in the correct database location
"""

import sqlite3
import os
import re

def generate_book_code(title, existing_codes):
    """Generate a unique book code from title"""
    # Extract alphabetic characters and take first 3
    clean_title = re.sub(r'[^A-Za-z]', '', title)
    if len(clean_title) >= 3:
        base_code = clean_title[:3].upper()
    elif len(clean_title) >= 2:
        base_code = clean_title[:2].upper() + 'X'
    else:
        base_code = 'BK'
    
    # Check for uniqueness
    code = base_code
    counter = 1
    while code.lower() in existing_codes:
        code = f"{base_code}{counter:03d}"
        counter += 1
        if counter > 999:
            # Fallback to random-like code
            code = f"BK{hash(title) % 1000:03d}"
            break
    
    existing_codes.add(code.lower())
    return code

def main():
    # Use the correct database path
    db_path = os.path.expanduser(r"~\AppData\Roaming\library-management-system\library.db")
    
    print(f"🔍 Using database: {db_path}")
    
    if not os.path.exists(db_path):
        print("❌ Database not found!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if books table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='books'
        """)
        
        if not cursor.fetchone():
            print("❌ No 'books' table found in database!")
            return
        
        # Check table structure
        cursor.execute("PRAGMA table_info(books)")
        columns = {col[1]: col[2] for col in cursor.fetchall()}
        
        print("📋 Books table structure:")
        for col_name, col_type in columns.items():
            print(f"  {col_name}: {col_type}")
        print()
        
        if 'book_code' not in columns:
            print("❌ No 'book_code' column found!")
            print("🔧 Adding book_code column...")
            cursor.execute("ALTER TABLE books ADD COLUMN book_code TEXT")
            conn.commit()
            print("✅ Added book_code column!")
        
        # Check current state of book codes
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(book_code) as with_codes,
                COUNT(*) - COUNT(book_code) as missing_codes
            FROM books
        """)
        
        total, with_codes, missing_codes = cursor.fetchone()
        
        print(f"📊 Book Code Status:")
        print(f"  Total books: {total}")
        print(f"  Books with codes: {with_codes}")
        print(f"  Books missing codes: {missing_codes}")
        print()
        
        if missing_codes == 0:
            print("✅ All books already have codes!")
            # Show sample books with codes
            cursor.execute("SELECT title, book_code FROM books WHERE book_code IS NOT NULL LIMIT 5")
            sample_books = cursor.fetchall()
            print("\n📚 Sample books with codes:")
            for title, code in sample_books:
                print(f"  {code}: {title}")
            conn.close()
            return
        
        print(f"🔧 Fixing {missing_codes} missing book codes...")
        
        # Get all existing book codes to avoid duplicates
        cursor.execute("SELECT book_code FROM books WHERE book_code IS NOT NULL")
        existing_codes = {code[0].lower() for code in cursor.fetchall() if code[0]}
        
        # Get books without codes
        cursor.execute("SELECT id, title FROM books WHERE book_code IS NULL OR book_code = ''")
        books_to_fix = cursor.fetchall()
        
        fixed = 0
        for book_id, title in books_to_fix:
            new_code = generate_book_code(title, existing_codes)
            
            cursor.execute(
                "UPDATE books SET book_code = ? WHERE id = ?",
                (new_code, book_id)
            )
            
            print(f"  ✅ {title[:50]:<50} -> {new_code}")
            fixed += 1
        
        conn.commit()
        
        print()
        print(f"🎉 Successfully fixed {fixed} book codes!")
        
        # Verify the fix
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(book_code) as with_codes
            FROM books
        """)
        
        total, with_codes = cursor.fetchone()
        print(f"📊 Final Status:")
        print(f"  Total books: {total}")
        print(f"  Books with codes: {with_codes}")
        print(f"  Success rate: {(with_codes/total*100):.1f}%")
        
        # Show sample of fixed books
        print("\n📚 Sample of books with codes:")
        cursor.execute("SELECT title, book_code FROM books ORDER BY book_code LIMIT 10")
        sample_books = cursor.fetchall()
        for title, code in sample_books:
            print(f"  {code}: {title}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    print("🔧 BOOK CODE FIXER")
    print("=" * 50)
    main()
    print("\n🎯 Next steps:")
    print("1. Restart your Tauri application")
    print("2. Check the Books Management page")
    print("3. Book codes should now display properly!")
