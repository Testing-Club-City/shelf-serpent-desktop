#!/usr/bin/env python3
"""
Check staff borrowings in Supabase vs Local
"""

import asyncio
import json
import httpx

class StaffBorrowingChecker:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }

    async def get_staff_borrowings_count(self) -> int:
        """Get total count of staff borrowings from Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/borrowings?borrower_type=eq.staff&select=count",
                headers={**self.headers, "Prefer": "count=exact"}
            )
            count_header = response.headers.get("content-range", "0")
            return int(count_header.split("/")[-1]) if "/" in count_header else 0

    async def get_staff_count(self) -> int:
        """Get total count of staff from Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/staff?select=count",
                headers={**self.headers, "Prefer": "count=exact"}
            )
            count_header = response.headers.get("content-range", "0")
            return int(count_header.split("/")[-1]) if "/" in count_header else 0

    async def get_staff_borrowings_sample(self, limit: int = 10):
        """Get sample staff borrowings from Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/borrowings?borrower_type=eq.staff&limit={limit}",
                headers=self.headers
            )
            return response.json()

    async def check_staff_foreign_keys(self):
        """Check for staff borrowings with missing staff records"""
        # Get all staff borrowings
        async with httpx.AsyncClient() as client:
            borrowings_resp = await client.get(
                f"{self.base_url}/borrowings?borrower_type=eq.staff&select=id,staff_id",
                headers=self.headers
            )
            staff_resp = await client.get(
                f"{self.base_url}/staff?select=id",
                headers=self.headers
            )
            
        borrowings = borrowings_resp.json()
        staff_ids = {s["id"] for s in staff_resp.json()}
        
        missing_staff = []
        for borrowing in borrowings:
            if borrowing.get("staff_id") and borrowing["staff_id"] not in staff_ids:
                missing_staff.append({
                    "borrowing_id": borrowing["id"],
                    "staff_id": borrowing["staff_id"]
                })
        
        return missing_staff

async def main():
    checker = StaffBorrowingChecker()
    
    print("🔍 Checking Staff Borrowings in Supabase...")
    
    # Get counts
    staff_borrowings_count = await checker.get_staff_borrowings_count()
    staff_count = await checker.get_staff_count()
    
    print(f"\n📊 Remote (Supabase) Counts:")
    print(f"  Staff Borrowings: {staff_borrowings_count}")
    print(f"  Staff Records: {staff_count}")
    
    print(f"\n📊 Local Database Counts:")
    print(f"  Staff Borrowings: 2552")
    print(f"  Staff Records: 229")
    
    # Check foreign key issues
    print(f"\n🔗 Checking Foreign Key Issues:")
    missing_staff = await checker.check_staff_foreign_keys()
    print(f"  Staff borrowings with missing staff: {len(missing_staff)}")
    
    if missing_staff:
        print(f"\n❌ Missing Staff Issues (first 5):")
        for issue in missing_staff[:5]:
            print(f"    Borrowing: {issue['borrowing_id']} -> Missing Staff: {issue['staff_id']}")
    
    # Get sample data
    print(f"\n📋 Sample Staff Borrowings from Supabase:")
    sample = await checker.get_staff_borrowings_sample(3)
    for borrowing in sample:
        print(f"  ID: {borrowing.get('id')}")
        print(f"  Staff ID: {borrowing.get('staff_id')}")
        print(f"  Book ID: {borrowing.get('book_id')}")
        print(f"  Status: {borrowing.get('status')}")
        print(f"  Synced: {borrowing.get('synced')}")
        print("  ---")

if __name__ == "__main__":
    asyncio.run(main())
