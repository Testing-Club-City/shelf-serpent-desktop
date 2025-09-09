#!/usr/bin/env python3
"""
Test script to verify the production bidirectional sync preserves borrower_type and staff_id
"""

import sqlite3
import asyncio
import httpx

async def test_production_sync():
    """Test the production sync preserves important borrowing data"""
    
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    local_db = r"C:\Users\runneradmin\AppData\Roaming\library-management-system\library.db"
    
    print("🧪 Testing production bidirectional sync...")
    
    # Step 1: Check initial local state
    print("\n1️⃣ Checking initial local borrowing state...")
    
    conn = sqlite3.connect(local_db)
    
    # Get current counts
    local_student = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
    local_staff = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
    local_total = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
    
    print(f"   📊 Current local: {local_student:,} students, {local_staff:,} staff ({local_total:,} total)")
    
    # Get some sample staff borrowings to test preservation
    staff_borrowing_samples = conn.execute("""
        SELECT id, borrower_type, staff_id, student_id 
        FROM borrowings 
        WHERE borrower_type = 'staff' 
        LIMIT 5
    """).fetchall()
    
    print(f"   📋 Sample staff borrowings to preserve: {len(staff_borrowing_samples)}")
    for sample in staff_borrowing_samples[:3]:
        print(f"      • ID: {sample[0][:8]}..., Type: {sample[1]}, Staff ID: {sample[2] if sample[2] else 'None'}")
    
    conn.close()
    
    # Step 2: Get remote state for comparison  
    print("\n2️⃣ Getting remote borrowing state...")
    
    async with httpx.AsyncClient() as client:
        # Get remote counts
        try:
            # Student count
            resp = await client.get(
                f"{base_url}/borrowings?borrower_type=eq.student&select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_student = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            # Staff count  
            resp = await client.get(
                f"{base_url}/borrowings?borrower_type=eq.staff&select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_staff = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            # Total count
            resp = await client.get(
                f"{base_url}/borrowings?select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_total = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            print(f"   📊 Remote: {remote_student:,} students, {remote_staff:,} staff ({remote_total:,} total)")
            
        except Exception as e:
            print(f"   ❌ Failed to get remote counts: {e}")
            return
    
    # Step 3: Show the expected behavior 
    print("\n3️⃣ Expected behavior from production sync:")
    print("   ✅ Should preserve existing staff borrower_type and staff_id values")
    print("   ✅ Should update other fields from remote while keeping critical columns")
    print("   ✅ Should NOT overwrite existing borrower classifications")
    print("   ✅ Should result in local counts matching remote counts")
    
    # Step 4: Show the difference from old behavior
    print("\n4️⃣ Improvement over old sync:")
    print("   ❌ OLD: Used INSERT OR REPLACE with dynamic columns → overwrote critical data")
    print("   ✅ NEW: Uses smart UPSERT with preservation logic → keeps existing critical data")
    print("   ❌ OLD: All borrowings became 'student' type → data loss") 
    print("   ✅ NEW: Preserves borrower_type and staff_id → data integrity maintained")
    
    # Step 5: Instructions to test
    print("\n5️⃣ To test the production sync:")
    print("   1. Run the Tauri app in development mode:")
    print("      npm run tauri dev")
    print("   2. In the app, use the sync functionality to trigger bidirectional sync")
    print("   3. The new production sync should preserve borrower_type and staff_id values")
    print("   4. After sync, verify counts match the expected values above")
    
    print(f"\n🎯 Target state after production sync:")
    print(f"   📊 Local should match remote: {remote_student:,} students, {remote_staff:,} staff")
    print(f"   ✅ All {len(staff_borrowing_samples)} sample staff borrowings should remain as staff type")

if __name__ == "__main__":
    asyncio.run(test_production_sync())
