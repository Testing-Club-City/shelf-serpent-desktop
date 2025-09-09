#!/usr/bin/env python3
"""
Fix borrowings using legacy book IDs from book copies
"""

import asyncio
import sqlite3
import httpx

class LegacyBookFixer:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        self.local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"

    def get_legacy_to_book_mapping(self):
        """Create mapping from legacy_book_id to actual book_id"""
        conn = sqlite3.connect(self.local_db)
        
        # Get books with legacy IDs
        cursor = conn.execute("SELECT id, legacy_book_id FROM books WHERE legacy_book_id IS NOT NULL")
        legacy_to_book = {}
        for row in cursor.fetchall():
            legacy_to_book[row[1]] = row[0]  # legacy_book_id -> book_id
        
        conn.close()
        return legacy_to_book

    def get_borrowings_with_legacy_mapping(self, limit=1000, offset=0):
        """Get borrowings with their legacy book ID from book copies"""
        conn = sqlite3.connect(self.local_db)
        
        cursor = conn.execute("""
            SELECT 
                b.id as borrowing_id,
                b.book_id as current_book_id,
                b.book_copy_id,
                bc.legacy_book_id as copy_legacy_book_id
            FROM borrowings b
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE bc.legacy_book_id IS NOT NULL
            ORDER BY b.id
            LIMIT ? OFFSET ?
        """, (limit, offset))
        
        records = cursor.fetchall()
        conn.close()
        return records

    async def update_borrowing_book_id(self, borrowing_id, correct_book_id):
        """Update borrowing's book_id in Supabase"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/borrowings?id=eq.{borrowing_id}",
                    headers=self.headers,
                    json={"book_id": correct_book_id}
                )
                return response.status_code in [200, 204]
            except Exception as e:
                return False

    async def fix_borrowings_with_legacy_ids(self):
        """Fix borrowings using legacy book IDs"""
        print("🔧 Fixing borrowings using legacy book IDs...")
        
        # Get legacy to book mapping
        legacy_to_book = self.get_legacy_to_book_mapping()
        print(f"📚 Found {len(legacy_to_book)} books with legacy IDs")
        
        # Get total borrowings with legacy mappings
        conn = sqlite3.connect(self.local_db)
        total_with_legacy = conn.execute("""
            SELECT COUNT(*) FROM borrowings b
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE bc.legacy_book_id IS NOT NULL
        """).fetchone()[0]
        conn.close()
        
        print(f"📊 Found {total_with_legacy:,} borrowings with legacy book mappings")
        
        if total_with_legacy == 0:
            print("❌ No borrowings found with legacy mappings!")
            return
        
        batch_size = 1000
        total_batches = (total_with_legacy + batch_size - 1) // batch_size
        
        fixed_count = 0
        error_count = 0
        
        for batch_num in range(total_batches):
            offset = batch_num * batch_size
            borrowings = self.get_borrowings_with_legacy_mapping(batch_size, offset)
            
            print(f"\n🔄 Batch {batch_num + 1}/{total_batches}: Processing {len(borrowings)} borrowings...")
            
            for borrowing in borrowings:
                borrowing_id = borrowing[0]
                current_book_id = borrowing[1]
                legacy_book_id = borrowing[3]
                
                # Find correct book_id from legacy_book_id
                correct_book_id = legacy_to_book.get(legacy_book_id)
                
                if correct_book_id and correct_book_id != current_book_id:
                    success = await self.update_borrowing_book_id(borrowing_id, correct_book_id)
                    if success:
                        fixed_count += 1
                    else:
                        error_count += 1
            
            processed = min((batch_num + 1) * batch_size, total_with_legacy)
            print(f"   ✅ Progress: {processed:,}/{total_with_legacy:,} ({processed/total_with_legacy*100:.1f}%)")
            print(f"   📊 Fixed: {fixed_count:,}, Errors: {error_count}")
            
            await asyncio.sleep(0.5)
        
        # Final summary
        print("\n" + "=" * 60)
        print("📋 LEGACY BOOK ID FIX COMPLETE")
        print("=" * 60)
        print(f"📊 Total Processed: {total_with_legacy:,}")
        print(f"✅ Successfully Fixed: {fixed_count:,}")
        print(f"❌ Errors: {error_count}")
        
        success_rate = (fixed_count / total_with_legacy) * 100 if total_with_legacy > 0 else 0
        print(f"📈 Success Rate: {success_rate:.2f}%")
        
        if success_rate >= 90:
            print("✅ FIX SUCCESSFUL - Borrowings should now work on Windows!")
        else:
            print("⚠️ FIX PARTIAL - Some issues may remain")

async def main():
    fixer = LegacyBookFixer()
    await fixer.fix_borrowings_with_legacy_ids()

if __name__ == "__main__":
    asyncio.run(main())
