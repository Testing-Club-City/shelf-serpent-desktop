#!/usr/bin/env python3
"""
Verify record-to-record mapping of borrowings
"""

import asyncio
import sqlite3
import httpx
import time

class RecordMapper:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        self.local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"

    def get_local_borrowings(self, limit=1000, offset=0):
        """Get borrowings from local database"""
        conn = sqlite3.connect(self.local_db)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT id, student_id, staff_id, book_id, status, borrower_type FROM borrowings ORDER BY id LIMIT ? OFFSET ?",
            (limit, offset)
        )
        records = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return records

    async def check_remote_record(self, borrowing_id):
        """Check if borrowing exists in remote with same data"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/borrowings?id=eq.{borrowing_id}&select=id,student_id,staff_id,book_id,status,borrower_type",
                headers=self.headers
            )
            if response.status_code == 200:
                data = response.json()
                return data[0] if data else None
            return None

    async def verify_batch(self, batch_num, local_records):
        """Verify a batch of records"""
        print(f"🔍 Batch {batch_num}: Checking {len(local_records)} records...", flush=True)
        
        matched = 0
        missing = 0
        mismatched = []
        
        for i, local_rec in enumerate(local_records):
            if i % 100 == 0:
                print(f"  Progress: {i}/{len(local_records)}", flush=True)
            
            remote_rec = await self.check_remote_record(local_rec['id'])
            
            if not remote_rec:
                missing += 1
            elif self.records_match(local_rec, remote_rec):
                matched += 1
            else:
                mismatched.append({
                    'id': local_rec['id'],
                    'local': local_rec,
                    'remote': remote_rec
                })
        
        print(f"  ✅ Batch {batch_num} done: {matched} matched, {missing} missing, {len(mismatched)} mismatched", flush=True)
        return matched, missing, mismatched

    def records_match(self, local, remote):
        """Check if local and remote records match"""
        key_fields = ['student_id', 'staff_id', 'book_id', 'status', 'borrower_type']
        for field in key_fields:
            if local.get(field) != remote.get(field):
                return False
        return True

    async def verify_all_records(self):
        """Verify all borrowing records"""
        conn = sqlite3.connect(self.local_db)
        total_records = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
        conn.close()
        
        batch_size = 1000
        total_batches = (total_records + batch_size - 1) // batch_size
        
        print(f"🚀 Verifying {total_records:,} borrowing records in {total_batches} batches")
        print(f"📦 Batch size: {batch_size}")
        
        total_matched = 0
        total_missing = 0
        all_mismatched = []
        
        start_time = time.time()
        
        for batch_num in range(1, total_batches + 1):
            offset = (batch_num - 1) * batch_size
            local_records = self.get_local_borrowings(batch_size, offset)
            
            if not local_records:
                break
            
            matched, missing, mismatched = await self.verify_batch(batch_num, local_records)
            
            total_matched += matched
            total_missing += missing
            all_mismatched.extend(mismatched)
            
            # Progress update
            processed = min(batch_num * batch_size, total_records)
            elapsed = time.time() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            eta = (total_records - processed) / rate if rate > 0 else 0
            
            print(f"📊 Progress: {processed:,}/{total_records:,} ({processed/total_records*100:.1f}%) - ETA: {eta/60:.1f}min\n", flush=True)
            
            await asyncio.sleep(0.1)  # Rate limiting
        
        # Final summary
        match_rate = (total_matched / total_records) * 100 if total_records > 0 else 0
        
        print("=" * 60)
        print("📋 RECORD-TO-RECORD VERIFICATION SUMMARY")
        print("=" * 60)
        print(f"📊 Total Records Checked: {total_records:,}")
        print(f"✅ Perfect Matches: {total_matched:,} ({match_rate:.2f}%)")
        print(f"❌ Missing in Remote: {total_missing:,}")
        print(f"⚠️ Data Mismatches: {len(all_mismatched):,}")
        
        if len(all_mismatched) > 0:
            print(f"\n🔍 Sample Mismatches (first 3):")
            for mismatch in all_mismatched[:3]:
                print(f"  ID: {mismatch['id']}")
                print(f"    Local:  {mismatch['local']}")
                print(f"    Remote: {mismatch['remote']}")
        
        if match_rate >= 99.9:
            print("✅ MAPPING STATUS: EXCELLENT - Records are perfectly mapped!")
        elif match_rate >= 95:
            print("⚠️ MAPPING STATUS: GOOD - Minor mapping issues")
        else:
            print("❌ MAPPING STATUS: POOR - Significant mapping issues")

async def main():
    mapper = RecordMapper()
    await mapper.verify_all_records()

if __name__ == "__main__":
    asyncio.run(main())
