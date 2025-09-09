#!/usr/bin/env python3
"""
Verify local borrowings are properly mapped with Supabase in batches
"""

import asyncio
import sqlite3
import httpx
import json
from typing import List, Dict, Set

class BorrowingVerifier:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        self.local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"
        self.batch_size = 1000

    def get_local_borrowing_ids(self, offset: int = 0) -> List[str]:
        """Get borrowing IDs from local database in batches"""
        conn = sqlite3.connect(self.local_db)
        cursor = conn.execute(
            "SELECT id FROM borrowings ORDER BY id LIMIT ? OFFSET ?", 
            (self.batch_size, offset)
        )
        ids = [row[0] for row in cursor.fetchall()]
        conn.close()
        return ids

    def get_local_total_count(self) -> int:
        """Get total borrowings count from local database"""
        conn = sqlite3.connect(self.local_db)
        cursor = conn.execute("SELECT COUNT(*) FROM borrowings")
        count = cursor.fetchone()[0]
        conn.close()
        return count

    async def get_remote_borrowing_ids(self, batch_ids: List[str]) -> Set[str]:
        """Get borrowing IDs from Supabase for given batch"""
        if not batch_ids:
            return set()
            
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/rpc/check_borrowing_ids",
                headers=self.headers,
                json={"ids": batch_ids}
            )
            
            if response.status_code == 200:
                return set(response.json())
            else:
                # Fallback: check each ID individually
                found_ids = set()
                for bid in batch_ids:
                    resp = await client.get(
                        f"{self.base_url}/borrowings?select=id&id=eq.{bid}",
                        headers=self.headers
                    )
                    if resp.status_code == 200 and resp.json():
                        found_ids.add(bid)
                return found_ids

    async def verify_batch(self, batch_num: int, local_ids: List[str]) -> Dict:
        """Verify a single batch of borrowings"""
        print(f"🔍 Processing batch {batch_num}... ({len(local_ids)} records)", flush=True)
        
        remote_ids = await self.get_remote_borrowing_ids(local_ids)
        local_set = set(local_ids)
        
        missing_in_remote = local_set - remote_ids
        extra_in_remote = remote_ids - local_set
        
        result = {
            "batch": batch_num,
            "local_count": len(local_ids),
            "remote_count": len(remote_ids),
            "missing_in_remote": len(missing_in_remote),
            "extra_in_remote": len(extra_in_remote),
            "sync_rate": round((len(remote_ids) / len(local_ids)) * 100, 2) if local_ids else 0
        }
        
        print(f"  ✅ Batch {batch_num} done - Sync: {result['sync_rate']}%", flush=True)
        
        return result

    async def verify_all_borrowings(self):
        """Verify all borrowings in batches"""
        total_local = self.get_local_total_count()
        total_batches = (total_local + self.batch_size - 1) // self.batch_size
        
        print(f"🚀 Starting verification of {total_local} borrowings in {total_batches} batches")
        print(f"📦 Batch size: {self.batch_size}")
        
        summary = {
            "total_local": total_local,
            "total_remote": 0,
            "total_missing": 0,
            "total_extra": 0,
            "batches_processed": 0
        }
        
        for batch_num in range(1, total_batches + 1):
            offset = (batch_num - 1) * self.batch_size
            local_ids = self.get_local_borrowing_ids(offset)
            
            if not local_ids:
                break
                
            batch_result = await self.verify_batch(batch_num, local_ids)
            
            summary["total_remote"] += batch_result["remote_count"]
            summary["total_missing"] += batch_result["missing_in_remote"]
            summary["total_extra"] += batch_result["extra_in_remote"]
            summary["batches_processed"] += 1
            
            print(f"  ✅ Batch {batch_num}/{total_batches} completed - Running total: {summary['total_remote']:,}/{summary['total_local']:,}\n", flush=True)
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.5)
        
        # Final summary
        overall_sync_rate = round((summary["total_remote"] / summary["total_local"]) * 100, 2)
        
        print("=" * 60)
        print("📋 FINAL VERIFICATION SUMMARY")
        print("=" * 60)
        print(f"📊 Total Local Borrowings: {summary['total_local']:,}")
        print(f"📊 Total Remote Borrowings: {summary['total_remote']:,}")
        print(f"📈 Overall Sync Rate: {overall_sync_rate}%")
        print(f"❌ Missing in Remote: {summary['total_missing']:,}")
        print(f"➕ Extra in Remote: {summary['total_extra']:,}")
        print(f"📦 Batches Processed: {summary['batches_processed']}")
        
        if overall_sync_rate >= 99.9:
            print("✅ SYNC STATUS: EXCELLENT - Borrowings are well mapped!")
        elif overall_sync_rate >= 95:
            print("⚠️ SYNC STATUS: GOOD - Minor sync issues detected")
        else:
            print("❌ SYNC STATUS: POOR - Significant sync issues detected")

async def main():
    verifier = BorrowingVerifier()
    await verifier.verify_all_borrowings()

if __name__ == "__main__":
    asyncio.run(main())
