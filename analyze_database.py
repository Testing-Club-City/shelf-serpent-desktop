#!/usr/bin/env python3
import sqlite3
import os
from pathlib import Path

def find_database():
    """Find the SQLite database file"""
    db_path = Path.home() / "AppData" / "Roaming" / "library-management-system" / "library.db"
    
    if db_path.exists():
        return str(db_path)
    
    print(f"Database not found at: {db_path}")
    return input("Enter database path manually: ")

def analyze_database():
    db_path = find_database()
    print(f"Analyzing database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n=== DATABASE ANALYSIS ===\n")
    
    # 1. Check book_copies table structure
    print("1. BOOK_COPIES TABLE STRUCTURE:")
    cursor.execute("PRAGMA table_info(book_copies)")
    columns = cursor.fetchall()
    for col in columns:
        print(f"   {col[1]} ({col[2]})")
    
    # 2. Count total book copies
    # Check if book_copies table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='book_copies'")
    if not cursor.fetchone():
        print("   book_copies table not found!")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"   Available tables: {[t[0] for t in tables]}")
        return
    
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total_copies = cursor.fetchone()[0]
    print(f"\n2. TOTAL BOOK COPIES: {total_copies}")
    
    # 3. Count book copies with legacy_book_id
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL AND legacy_book_id != ''")
    with_legacy = cursor.fetchone()[0]
    print(f"   With legacy_book_id: {with_legacy}")
    print(f"   Without legacy_book_id: {total_copies - with_legacy}")
    
    # 4. Check borrowings with missing legacy IDs
    print("\n3. BORROWINGS ANALYSIS:")
    cursor.execute("""
        SELECT COUNT(*) FROM borrowings b
        JOIN book_copies bc ON b.book_copy_id = bc.id
        WHERE b.status = 'borrowed'
    """)
    active_borrowings = cursor.fetchone()[0]
    print(f"   Total active borrowings: {active_borrowings}")
    
    cursor.execute("""
        SELECT COUNT(*) FROM borrowings b
        JOIN book_copies bc ON b.book_copy_id = bc.id
        WHERE b.status = 'borrowed' 
        AND (bc.legacy_book_id IS NULL OR bc.legacy_book_id = '')
    """)
    borrowings_no_legacy = cursor.fetchone()[0]
    print(f"   Active borrowings without legacy ID: {borrowings_no_legacy}")
    
    # 5. Show sample records without legacy IDs
    print("\n4. SAMPLE RECORDS WITHOUT LEGACY IDs:")
    cursor.execute("""
        SELECT b.id, bk.title, bc.id as copy_id, bc.legacy_book_id, s.first_name, s.last_name
        FROM borrowings b
        JOIN book_copies bc ON b.book_copy_id = bc.id
        JOIN books bk ON bc.book_id = bk.id
        JOIN students s ON b.student_id = s.id
        WHERE b.status = 'borrowed' 
        AND (bc.legacy_book_id IS NULL OR bc.legacy_book_id = '')
        LIMIT 10
    """)
    
    records = cursor.fetchall()
    if records:
        print("   Borrowing ID | Book Title | Copy ID | Legacy ID | Student")
        print("   " + "-" * 70)
        for record in records:
            title = record[1][:30] + "..." if len(record[1]) > 30 else record[1]
            print(f"   {record[0]:<12} | {title:<30} | {record[2]:<7} | {record[3] or 'NULL':<9} | {record[4]} {record[5]}")
    
    # 6. Show sample records WITH legacy IDs
    print("\n5. SAMPLE RECORDS WITH LEGACY IDs:")
    cursor.execute("""
        SELECT b.id, bk.title, bc.id as copy_id, bc.legacy_book_id, s.first_name, s.last_name
        FROM borrowings b
        JOIN book_copies bc ON b.book_copy_id = bc.id
        JOIN books bk ON bc.book_id = bk.id
        JOIN students s ON b.student_id = s.id
        WHERE b.status = 'borrowed' 
        AND bc.legacy_book_id IS NOT NULL AND bc.legacy_book_id != ''
        LIMIT 10
    """)
    
    records = cursor.fetchall()
    if records:
        print("   Borrowing ID | Book Title | Copy ID | Legacy ID | Student")
        print("   " + "-" * 70)
        for record in records:
            title = record[1][:30] + "..." if len(record[1]) > 30 else record[1]
            print(f"   {record[0]:<12} | {title:<30} | {record[2]:<7} | {record[3]:<9} | {record[4]} {record[5]}")
    
    # 7. Check date patterns
    print("\n6. DATE ANALYSIS:")
    cursor.execute("""
        SELECT 
            DATE(b.borrowed_at) as borrow_date,
            COUNT(*) as total,
            SUM(CASE WHEN bc.legacy_book_id IS NOT NULL AND bc.legacy_book_id != '' THEN 1 ELSE 0 END) as with_legacy
        FROM borrowings b
        JOIN book_copies bc ON b.book_copy_id = bc.id
        WHERE b.status = 'borrowed'
        GROUP BY DATE(b.borrowed_at)
        ORDER BY borrow_date DESC
        LIMIT 10
    """)
    
    date_records = cursor.fetchall()
    if date_records:
        print("   Date       | Total | With Legacy | Without Legacy")
        print("   " + "-" * 50)
        for record in date_records:
            without_legacy = record[1] - record[2]
            print(f"   {record[0]:<10} | {record[1]:<5} | {record[2]:<11} | {without_legacy}")
    
    conn.close()
    print(f"\n=== ANALYSIS COMPLETE ===")

if __name__ == "__main__":
    analyze_database()