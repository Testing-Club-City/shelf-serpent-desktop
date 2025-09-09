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
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total_copies = cursor.fetchone()[0]
    print(f"\n2. TOTAL BOOK COPIES: {total_copies}")
    
    # 3. Count book copies with legacy_book_id
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL AND legacy_book_id != ''")
    with_legacy = cursor.fetchone()[0]
    print(f"   With legacy_book_id: {with_legacy}")
    print(f"   Without legacy_book_id: {total_copies - with_legacy}")
    
    # 4. Show sample records without legacy IDs
    print("\n3. SAMPLE BOOK COPIES WITHOUT LEGACY IDs:")
    cursor.execute("""
        SELECT id, title, copy_identifier, legacy_book_id, status
        FROM book_copies
        WHERE legacy_book_id IS NULL OR legacy_book_id = ''
        LIMIT 10
    """)
    
    records = cursor.fetchall()
    if records:
        print("   Copy ID | Book Title | Copy Identifier | Legacy ID | Status")
        print("   " + "-" * 70)
        for record in records:
            title = record[1][:25] + "..." if len(record[1]) > 25 else record[1]
            print(f"   {record[0]:<7} | {title:<25} | {record[2] or 'N/A':<15} | {record[3] or 'NULL':<9} | {record[4]}")
    else:
        print("   No records found without legacy IDs")
    
    # 5. Show sample records WITH legacy IDs
    print("\n4. SAMPLE BOOK COPIES WITH LEGACY IDs:")
    cursor.execute("""
        SELECT id, title, copy_identifier, legacy_book_id, status
        FROM book_copies
        WHERE legacy_book_id IS NOT NULL AND legacy_book_id != ''
        LIMIT 10
    """)
    
    records = cursor.fetchall()
    if records:
        print("   Copy ID | Book Title | Copy Identifier | Legacy ID | Status")
        print("   " + "-" * 70)
        for record in records:
            title = record[1][:25] + "..." if len(record[1]) > 25 else record[1]
            print(f"   {record[0]:<7} | {title:<25} | {record[2] or 'N/A':<15} | {record[3]:<9} | {record[4]}")
    
    # 6. Check borrowings table
    print("\n5. BORROWINGS TABLE CHECK:")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='borrowings'")
    if cursor.fetchone():
        cursor.execute("SELECT COUNT(*) FROM borrowings")
        total_borrowings = cursor.fetchone()[0]
        print(f"   Total borrowings: {total_borrowings}")
        
        cursor.execute("SELECT COUNT(*) FROM borrowings WHERE status = 'borrowed'")
        active_borrowings = cursor.fetchone()[0]
        print(f"   Active borrowings: {active_borrowings}")
    else:
        print("   Borrowings table not found")
    
    # 7. Check creation date patterns
    print("\n6. CREATION DATE ANALYSIS:")
    cursor.execute("""
        SELECT 
            DATE(created_at) as creation_date,
            COUNT(*) as total,
            SUM(CASE WHEN legacy_book_id IS NOT NULL AND legacy_book_id != '' THEN 1 ELSE 0 END) as with_legacy
        FROM book_copies
        WHERE created_at IS NOT NULL
        GROUP BY DATE(created_at)
        ORDER BY creation_date DESC
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
    print(f"\n=== ANALYSIS COMPLETE ===\n")
    print("SUMMARY:")
    print(f"- Total book copies: {total_copies}")
    print(f"- With legacy IDs: {with_legacy} ({with_legacy/total_copies*100:.1f}%)")
    print(f"- Without legacy IDs: {total_copies - with_legacy} ({(total_copies - with_legacy)/total_copies*100:.1f}%)")
    print("\nThe issue: Some book copies don't have legacy_book_id values, causing 'N/A' in the UI.")

if __name__ == "__main__":
    analyze_database()