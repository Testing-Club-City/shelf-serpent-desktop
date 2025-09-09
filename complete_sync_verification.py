#!/usr/bin/env python3
"""
Complete sync verification - all columns for all borrowing records
"""

import asyncio
import sqlite3
import httpx
import time

class CompleteSyncVerifier:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        self.local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"

    def get_local_borrowings_all_columns(self, limit=25, offset=0):
        """Get all borrowing columns from local database"""
        conn = sqlite3.connect(self.local_db)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT * FROM borrowings ORDER BY id LIMIT ? OFFSET ?",
            (limit, offset)
        )
        records = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return records

    async def get_remote_batch_all_columns(self, ids):
        """Get all columns for multiple records from remote"""
        if len(ids) > 25:
            ids = ids[:25]
            
        id_filter = "(" + ",".join(ids) + ")"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/borrowings?id=in.{id_filter}",
                    headers=self.headers
                )
                if response.status_code == 200:
                    return {rec['id']: rec for rec in response.json()}
                else:
                    return {}
            except Exception as e:
                print(f"❌ Request failed: {e}")
                return {}

    def compare_all_columns(self, local_records, remote_dict):
        """Compare all columns between local and remote records"""
        matched = 0
        missing = 0
        column_mismatches = {}
        
        for local_rec in local_records:
            rec_id = local_rec['id']
            remote_rec = remote_dict.get(rec_id)
            
            if not remote_rec:
                missing += 1
                continue
            
            # Compare all columns
            all_match = True
            for column, local_value in local_rec.items():
                remote_value = remote_rec.get(column)
                
                # Handle None/null differences
                if local_value != remote_value:
                    if not (local_value is None and remote_value is None):
                        all_match = False
                        if column not in column_mismatches:
                            column_mismatches[column] = 0
                        column_mismatches[column] += 1
            
            if all_match:
                matched += 1
        
        return matched, missing, column_mismatches

    async def verify_complete_sync(self):
        """Verify complete sync of all columns for all records"""
        conn = sqlite3.connect(self.local_db)
        total_records = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
        conn.close()
        
        batch_size = 25  # Smaller for complete column comparison
        total_batches = (total_records + batch_size - 1) // batch_size
        
        print(f"🚀 COMPLETE SYNC VERIFICATION")
        print(f"📊 Total Records: {total_records:,}")
        print(f"📦 Batch Size: {batch_size}")
        print(f"🔄 Total Batches: {total_batches}")
        print("=" * 60)
        
        total_matched = 0
        total_missing = 0
        all_column_mismatches = {}
        
        start_time = time.time()
        
        for batch_num in range(1, total_batches + 1):
            offset = (batch_num - 1) * batch_size
            local_records = self.get_local_borrowings_all_columns(batch_size, offset)
            
            if not local_records:
                break
            
            # Get remote records
            ids = [rec['id'] for rec in local_records]
            remote_dict = await self.get_remote_batch_all_columns(ids)
            
            # Compare all columns
            matched, missing, column_mismatches = self.compare_all_columns(local_records, remote_dict)
            
            total_matched += matched
            total_missing += missing
            
            # Aggregate column mismatches
            for column, count in column_mismatches.items():
                if column not in all_column_mismatches:
                    all_column_mismatches[column] = 0
                all_column_mismatches[column] += count
            
            # Progress update every 50 batches
            if batch_num % 50 == 0 or batch_num == total_batches:
                processed = min(batch_num * batch_size, total_records)
                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                eta = (total_records - processed) / rate if rate > 0 else 0
                
                print(f"📊 Batch {batch_num:4d}/{total_batches} | "
                      f"Processed: {processed:6,}/{total_records:,} ({processed/total_records*100:5.1f}%) | "
                      f"Rate: {rate:4.0f}/sec | "
                      f"ETA: {eta/60:4.1f}min", flush=True)
            
            await asyncio.sleep(0.1)  # Rate limiting
        
        # Final comprehensive summary
        elapsed_total = time.time() - start_time
        match_rate = (total_matched / total_records) * 100 if total_records > 0 else 0
        
        print("\n" + "=" * 60)
        print("📋 COMPLETE SYNC VERIFICATION RESULTS")
        print("=" * 60)
        print(f"📊 Total Records Processed: {total_records:,}")
        print(f"✅ Perfect Column Matches: {total_matched:,} ({match_rate:.3f}%)")
        print(f"❌ Missing Records: {total_missing:,}")
        print(f"⏱️ Total Processing Time: {elapsed_total/60:.1f} minutes")
        print(f"🚀 Average Processing Rate: {total_records/elapsed_total:.0f} records/second")
        
        if all_column_mismatches:
            print(f"\n⚠️ COLUMN MISMATCH SUMMARY:")
            print(f"{'Column':<25} {'Mismatches':<10} {'%'}")
            print("-" * 45)
            for column, count in sorted(all_column_mismatches.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_records) * 100
                print(f"{column:<25} {count:<10} {percentage:.2f}%")
        else:
            print(f"\n✅ NO COLUMN MISMATCHES FOUND!")
        
        # Final status
        if match_rate >= 99.99:
            print(f"\n🎯 SYNC STATUS: PERFECT - All records and columns match!")
        elif match_rate >= 99.9:
            print(f"\n✅ SYNC STATUS: EXCELLENT - Minimal discrepancies")
        elif match_rate >= 95:
            print(f"\n⚠️ SYNC STATUS: GOOD - Minor sync issues")
        else:
            print(f"\n❌ SYNC STATUS: POOR - Significant sync issues")
        
        print(f"\n🔄 RECOMMENDATION: {'No action needed' if match_rate >= 99.9 else 'Review column mismatches'}")

async def main():
    verifier = CompleteSyncVerifier()
    await verifier.verify_complete_sync()

if __name__ == "__main__":
    asyncio.run(main())
