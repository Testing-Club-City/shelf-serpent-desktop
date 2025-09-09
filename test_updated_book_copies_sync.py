#!/usr/bin/env python3
"""
Test script to verify the updated book copies sync is working correctly
"""

import subprocess
import sqlite3
import os
from datetime import datetime

def check_local_database():
    """Check the local database for book copies"""
    db_path = os.path.expanduser("~/.local/share/library-management-system/library.db")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check total book copies
        cursor.execute("SELECT COUNT(*) FROM book_copies")
        total_copies = cursor.fetchone()[0]
        print(f"📊 Total book copies in local DB: {total_copies}")
        
        # Check for proper data (not placeholder data)
        cursor.execute("""
            SELECT COUNT(*) FROM book_copies 
            WHERE title != 'Book Copy ' || id 
            AND author != 'Unknown Author'
        """)
        proper_data = cursor.fetchone()[0]
        print(f"✅ Book copies with proper book data: {proper_data}")
        
        # Check for placeholder data (old sync)
        cursor.execute("""
            SELECT COUNT(*) FROM book_copies 
            WHERE title = 'Book Copy ' || id 
            OR author = 'Unknown Author'
        """)
        placeholder_data = cursor.fetchone()[0]
        print(f"⚠️  Book copies with placeholder data: {placeholder_data}")
        
        # Sample of corrected data
        cursor.execute("""
            SELECT id, isbn, title, author, copy_identifier, status, condition
            FROM book_copies 
            WHERE title != 'Book Copy ' || id 
            LIMIT 3
        """)
        
        samples = cursor.fetchall()
        if samples:
            print("\n📋 Sample of corrected book copy data:")
            print("-" * 80)
            for sample in samples:
                print(f"ID: {sample[0]}")
                print(f"ISBN: {sample[1]}")
                print(f"Title: {sample[2]}")
                print(f"Author: {sample[3]}")
                print(f"Copy ID: {sample[4]}")
                print(f"Status: {sample[5]}")
                print(f"Condition: {sample[6]}")
                print("-" * 40)
        
        conn.close()
        
        # Summary
        if proper_data > placeholder_data:
            print("✅ SUCCESS: Most book copies have proper book data!")
        elif proper_data > 0:
            print("⚠️  PARTIAL: Some book copies have proper data, sync may be in progress")
        else:
            print("❌ ISSUE: All book copies still have placeholder data")
            
    except Exception as e:
        print(f"❌ Error checking database: {e}")

def run_sync_test():
    """Run the book copies sync and check results"""
    print("🔄 Testing updated book copies sync...")
    print("=" * 60)
    
    # Check before sync
    print("📊 BEFORE SYNC:")
    check_local_database()
    
    print(f"\n🚀 Running sync at {datetime.now()}")
    print("=" * 60)
    
    # Note: You would run the actual Rust sync here
    # For now, we'll just check the current state
    print("ℹ️  To run the actual sync, use:")
    print("   cargo run --bin debug_book_copies_sync")
    print("   or call sync_book_copies_in_batches_fixed() from your Rust code")
    
    print(f"\n📊 CURRENT STATE:")
    check_local_database()

if __name__ == "__main__":
    run_sync_test()
