#!/usr/bin/env python3
"""
Check legacy ID mapping in borrowings table
"""

import sqlite3

def check_legacy_mapping():
    """Check what legacy ID fields are available in borrowings"""
    
    local_db = r"C:\Users\runneradmin\AppData\Roaming\library-management-system\library.db"
    
    print("🔍 Checking legacy ID mapping in borrowings...")
    
    conn = sqlite3.connect(local_db)
    
    try:
        # Check borrowings table schema
        print("\n📋 Borrowings table schema:")
        schema_info = conn.execute("PRAGMA table_info(borrowings)").fetchall()
        for col in schema_info:
            if any(field in col[1].lower() for field in ['id', 'book', 'copy', 'track', 'legacy']):
                print(f"   • {col[1]} ({col[2]}) - {'NOT NULL' if col[3] else 'NULL OK'}")
        
        # Check what fields are populated
        print("\n📊 Field population status:")
        total_borrowings = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
        print(f"   Total borrowings: {total_borrowings:,}")
        
        # Check book_copy_id
        book_copy_id_count = conn.execute("SELECT COUNT(*) FROM borrowings WHERE book_copy_id IS NOT NULL AND book_copy_id != ''").fetchone()[0]
        print(f"   📖 book_copy_id populated: {book_copy_id_count:,} ({book_copy_id_count/total_borrowings*100:.1f}%)")
        
        # Check tracking_code
        tracking_code_count = conn.execute("SELECT COUNT(*) FROM borrowings WHERE tracking_code IS NOT NULL AND tracking_code != ''").fetchone()[0]
        print(f"   🏷️  tracking_code populated: {tracking_code_count:,} ({tracking_code_count/total_borrowings*100:.1f}%)")
        
        # Check book_id
        book_id_count = conn.execute("SELECT COUNT(*) FROM borrowings WHERE book_id IS NOT NULL AND book_id != ''").fetchone()[0]
        print(f"   📚 book_id populated: {book_id_count:,} ({book_id_count/total_borrowings*100:.1f}%)")
        
        # Sample some borrowings to see what data we have
        print("\n📋 Sample borrowing data:")
        samples = conn.execute("""
            SELECT id, book_id, book_copy_id, tracking_code, borrower_type
            FROM borrowings 
            LIMIT 10
        """).fetchall()
        
        for sample in samples[:5]:
            borrowing_id = sample[0][:8] + "..."
            book_id = sample[1][:8] + "..." if sample[1] else "None"
            book_copy_id = sample[2][:8] + "..." if sample[2] else "None"  
            tracking_code = sample[3] if sample[3] else "None"
            borrower_type = sample[4]
            
            print(f"   • ID: {borrowing_id}, Book: {book_id}, Copy: {book_copy_id}, Track: {tracking_code}, Type: {borrower_type}")
        
        # Check if book_copies table has legacy_book_id
        print("\n📖 Checking book_copies table for legacy mapping...")
        try:
            book_copies_info = conn.execute("PRAGMA table_info(book_copies)").fetchall()
            legacy_fields = [col[1] for col in book_copies_info if 'legacy' in col[1].lower()]
            print(f"   Legacy fields in book_copies: {legacy_fields}")
            
            if 'legacy_book_id' in legacy_fields:
                legacy_populated = conn.execute("SELECT COUNT(*) FROM book_copies WHERE legacy_book_id IS NOT NULL").fetchone()[0]
                total_copies = conn.execute("SELECT COUNT(*) FROM book_copies").fetchone()[0]
                print(f"   📚 book_copies with legacy_book_id: {legacy_populated:,} of {total_copies:,} ({legacy_populated/total_copies*100:.1f}%)")
                
                # Check relationship between borrowings and book_copies
                print("\n🔗 Checking borrowing -> book_copy -> legacy mapping...")
                
                # Count borrowings that can be mapped to legacy IDs through book_copies
                legacy_mappable = conn.execute("""
                    SELECT COUNT(DISTINCT b.id)
                    FROM borrowings b
                    JOIN books bk ON b.book_id = bk.id
                    JOIN book_copies bc ON bk.isbn = bc.isbn
                    WHERE bc.legacy_book_id IS NOT NULL
                """).fetchone()[0]
                
                print(f"   📊 Borrowings mappable to legacy IDs: {legacy_mappable:,} ({legacy_mappable/total_borrowings*100:.1f}%)")
                
                # Sample the mappable ones
                print("\n📋 Sample legacy mappings:")
                legacy_samples = conn.execute("""
                    SELECT b.id, b.borrower_type, bc.legacy_book_id, bk.title
                    FROM borrowings b
                    JOIN books bk ON b.book_id = bk.id  
                    JOIN book_copies bc ON bk.isbn = bc.isbn
                    WHERE bc.legacy_book_id IS NOT NULL
                    LIMIT 5
                """).fetchall()
                
                for sample in legacy_samples:
                    borrowing_id = sample[0][:8] + "..."
                    borrower_type = sample[1]
                    legacy_book_id = sample[2]
                    title = sample[3][:30] + "..." if len(sample[3]) > 30 else sample[3]
                    
                    print(f"   • Borrowing {borrowing_id} ({borrower_type}) -> Legacy ID: {legacy_book_id} ({title})")
            
        except Exception as e:
            print(f"   ❌ Error checking book_copies: {e}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_legacy_mapping()
