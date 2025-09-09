#!/usr/bin/env python3
"""
Analyze how Linux actually displays borrowings correctly despite corrupted data
"""

import sqlite3

def analyze_linux_logic():
    local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"
    conn = sqlite3.connect(local_db)
    
    print("🔍 Analyzing how Linux displays borrowings correctly...")
    
    # Check what data Linux actually uses for display
    cursor = conn.execute("""
        SELECT 
            b.id,
            b.book_id,
            b.book_copy_id,
            b.tracking_code,
            bc.legacy_book_id as copy_legacy_id,
            bk.title as book_title,
            bk.legacy_book_id as book_legacy_id
        FROM borrowings b
        LEFT JOIN book_copies bc ON b.book_copy_id = bc.id  
        LEFT JOIN books bk ON b.book_id = bk.id
        LIMIT 5
    """)
    
    print("\n📋 SAMPLE BORROWING DATA STRUCTURE:")
    print("ID | Book ID | Copy ID | Tracking | Copy Legacy | Book Title | Book Legacy")
    print("-" * 100)
    
    for row in cursor.fetchall():
        print(f"{row[0][:8]}... | {row[1][:8]}... | {row[2][:8] if row[2] else 'None'}... | {row[3] or 'None'} | {row[4] or 'None'} | {row[5] or 'None'} | {row[6] or 'None'}")
    
    # Check if Linux uses tracking_code for book identification
    tracking_codes = conn.execute("SELECT COUNT(DISTINCT tracking_code) FROM borrowings WHERE tracking_code IS NOT NULL").fetchone()[0]
    print(f"\n📊 Unique tracking codes in borrowings: {tracking_codes}")
    
    # Check if book_copy_id provides the real book info
    copy_with_legacy = conn.execute("SELECT COUNT(*) FROM borrowings b JOIN book_copies bc ON b.book_copy_id = bc.id WHERE bc.legacy_book_id IS NOT NULL").fetchone()[0]
    print(f"📊 Borrowings with book_copy legacy IDs: {copy_with_legacy:,}")
    
    # The key insight: Linux might be using book_copy.legacy_book_id to find the actual book
    print(f"\n💡 HYPOTHESIS: Linux uses book_copy.legacy_book_id to identify books")
    print(f"   This bypasses the corrupted book_id field in borrowings")
    print(f"   Windows expects proper book_id relationships")
    
    conn.close()

if __name__ == "__main__":
    analyze_linux_logic()
