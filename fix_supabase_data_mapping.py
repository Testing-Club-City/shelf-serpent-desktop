#!/usr/bin/env python3
"""
Fix Supabase data to match local database structure with proper legacy book ID references
"""

import asyncio
import sqlite3
import httpx
import json

class SupabaseDataFixer:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        self.local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"

    def get_local_book_copy_mappings(self):
        """Get book copy to legacy book ID mappings from local database"""
        conn = sqlite3.connect(self.local_db)
        conn.row_factory = sqlite3.Row
        
        # Get book copies with their legacy book IDs
        cursor = conn.execute("""
            SELECT 
                bc.id as copy_id,
                bc.book_id,
                bc.legacy_book_id,
                b.title,
                b.legacy_book_id as book_legacy_id
            FROM book_copies bc
            LEFT JOIN books b ON bc.book_id = b.id
            WHERE bc.legacy_book_id IS NOT NULL
        """)
        
        mappings = {}
        for row in cursor.fetchall():
            mappings[row['copy_id']] = {
                'book_id': row['book_id'],
                'legacy_book_id': row['legacy_book_id'],
                'book_legacy_id': row['book_legacy_id'],
                'title': row['title']
            }
        
        conn.close()
        return mappings

    def get_local_borrowings_with_correct_mapping(self, limit=1000, offset=0):
        """Get borrowings with correct book mappings from local database"""
        conn = sqlite3.connect(self.local_db)
        conn.row_factory = sqlite3.Row
        
        cursor = conn.execute("""
            SELECT 
                b.id,
                b.book_copy_id,
                bc.legacy_book_id as copy_legacy_book_id,
                bc.book_id as correct_book_id,
                bk.legacy_book_id as book_legacy_book_id
            FROM borrowings b
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            LEFT JOIN books bk ON bc.book_id = bk.id
            ORDER BY b.id
            LIMIT ? OFFSET ?
        """, (limit, offset))
        
        records = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return records

    async def update_borrowing_book_mapping(self, borrowing_id, correct_book_id):
        """Update a single borrowing's book_id in Supabase"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/borrowings?id=eq.{borrowing_id}",
                    headers=self.headers,
                    json={"book_id": correct_book_id}
                )
                return response.status_code in [200, 204]
            except Exception as e:
                print(f"❌ Error updating borrowing {borrowing_id}: {e}")
                return False

    async def update_book_legacy_id(self, book_id, legacy_book_id):
        """Update a book's legacy_book_id in Supabase"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/books?id=eq.{book_id}",
                    headers=self.headers,
                    json={"legacy_book_id": legacy_book_id}
                )
                return response.status_code in [200, 204]
            except Exception as e:
                print(f"❌ Error updating book {book_id}: {e}")
                return False

    async def fix_all_data_mappings(self):
        """Fix all data mappings in Supabase to match local database"""
        print("🔧 Starting Supabase Data Mapping Fix...")
        
        # Step 1: Get local mappings
        print("\n📋 Step 1: Getting local book copy mappings...")
        copy_mappings = self.get_local_book_copy_mappings()
        print(f"   Found {len(copy_mappings):,} book copies with legacy IDs")
        
        # Step 2: Get total borrowings count
        conn = sqlite3.connect(self.local_db)
        total_borrowings = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
        conn.close()
        
        print(f"\n📊 Step 2: Processing {total_borrowings:,} borrowings...")
        
        batch_size = 1000
        total_batches = (total_borrowings + batch_size - 1) // batch_size
        
        fixed_borrowings = 0
        fixed_books = set()
        errors = 0
        
        for batch_num in range(total_batches):
            offset = batch_num * batch_size
            local_borrowings = self.get_local_borrowings_with_correct_mapping(batch_size, offset)
            
            print(f"\n🔄 Batch {batch_num + 1}/{total_batches}: Processing {len(local_borrowings)} borrowings...")
            
            for borrowing in local_borrowings:
                borrowing_id = borrowing['id']
                correct_book_id = borrowing['correct_book_id']
                book_legacy_id = borrowing['book_legacy_book_id']
                
                if correct_book_id:
                    # Update borrowing's book_id
                    success = await self.update_borrowing_book_mapping(borrowing_id, correct_book_id)
                    if success:
                        fixed_borrowings += 1
                    else:
                        errors += 1
                    
                    # Update book's legacy_book_id if needed
                    if book_legacy_id and correct_book_id not in fixed_books:
                        book_success = await self.update_book_legacy_id(correct_book_id, book_legacy_id)
                        if book_success:
                            fixed_books.add(correct_book_id)
            
            # Progress update
            processed = min((batch_num + 1) * batch_size, total_borrowings)
            print(f"   ✅ Progress: {processed:,}/{total_borrowings:,} ({processed/total_borrowings*100:.1f}%)")
            print(f"   📊 Fixed: {fixed_borrowings:,} borrowings, {len(fixed_books)} books")
            
            await asyncio.sleep(0.5)  # Rate limiting
        
        # Final summary
        print("\n" + "=" * 60)
        print("📋 SUPABASE DATA MAPPING FIX COMPLETE")
        print("=" * 60)
        print(f"📊 Total Borrowings Processed: {total_borrowings:,}")
        print(f"✅ Borrowings Fixed: {fixed_borrowings:,}")
        print(f"📚 Books Updated: {len(fixed_books)}")
        print(f"❌ Errors: {errors}")
        
        success_rate = (fixed_borrowings / total_borrowings) * 100 if total_borrowings > 0 else 0
        print(f"📈 Success Rate: {success_rate:.2f}%")
        
        if success_rate >= 95:
            print("✅ MAPPING FIX: SUCCESSFUL - Data should now work on Windows!")
        else:
            print("⚠️ MAPPING FIX: PARTIAL - Some issues remain")
        
        print(f"\n💡 NEXT STEPS:")
        print(f"   1. Test Windows application")
        print(f"   2. Verify borrowings display correctly")
        print(f"   3. Check legacy book ID references work")

async def main():
    fixer = SupabaseDataFixer()
    await fixer.fix_all_data_mappings()

if __name__ == "__main__":
    asyncio.run(main())
