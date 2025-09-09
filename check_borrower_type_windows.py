#!/usr/bin/env python3
"""
Check borrower_type mismatch between local and remote - Windows version
"""

import asyncio
import sqlite3
import httpx

async def check_borrower_type_mismatch():
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    local_db = r"C:\Users\runneradmin\AppData\Roaming\library-management-system\library.db"
    
    print("🔍 Checking borrower_type mismatch...")
    
    # Local counts by borrower_type
    conn = sqlite3.connect(local_db)
    local_student = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
    local_staff = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
    local_null = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type IS NULL").fetchone()[0]
    local_total = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
    
    # Check for staff_id and student_id populated
    staff_with_id = conn.execute("SELECT COUNT(*) FROM borrowings WHERE staff_id IS NOT NULL AND staff_id != ''").fetchone()[0]
    student_with_id = conn.execute("SELECT COUNT(*) FROM borrowings WHERE student_id IS NOT NULL AND student_id != ''").fetchone()[0]
    
    conn.close()
    
    # Remote counts by borrower_type
    async with httpx.AsyncClient() as client:
        try:
            # Student borrowings count
            resp = await client.get(
                f"{base_url}/borrowings?borrower_type=eq.student&select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_student = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            # Staff borrowings count
            resp = await client.get(
                f"{base_url}/borrowings?borrower_type=eq.staff&select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_staff = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            # Total remote count
            resp = await client.get(
                f"{base_url}/borrowings?select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_total = int(resp.headers.get("content-range", "0").split("/")[-1])
            
        except Exception as e:
            print(f"❌ Error connecting to remote: {e}")
            return
    
    print(f"\n📊 LOCAL DATABASE ANALYSIS:")
    print(f"  Total borrowings: {local_total:,}")
    print(f"  Student type: {local_student:,}")
    print(f"  Staff type: {local_staff:,}")
    print(f"  NULL type: {local_null:,}")
    print(f"  With student_id: {student_with_id:,}")
    print(f"  With staff_id: {staff_with_id:,}")
    
    print(f"\n📊 REMOTE DATABASE:")
    print(f"  Total borrowings: {remote_total:,}")
    print(f"  Student type: {remote_student:,}")
    print(f"  Staff type: {remote_staff:,}")
    
    print(f"\n📊 COMPARISON:")
    print(f"Type       Local      Remote     Match")
    print("-" * 40)
    print(f"Student    {local_student:<10,} {remote_student:<10,} {'✅' if local_student == remote_student else '❌'}")
    print(f"Staff      {local_staff:<10,} {remote_staff:<10,} {'✅' if local_staff == remote_staff else '❌'}")
    print(f"Total      {local_total:<10,} {remote_total:<10,} {'✅' if local_total == remote_total else '❌'}")
    
    # Analysis
    if local_student == local_total:
        print(f"\n🚨 CRITICAL ISSUE: ALL {local_total:,} local borrowings are marked as 'student'!")
        print(f"   But {staff_with_id:,} borrowings have staff_id populated.")
        print(f"   This suggests staff borrowings are misclassified.")
    
    if local_staff != remote_staff:
        print(f"\n❌ STAFF BORROWINGS MISMATCH:")
        print(f"   Local: {local_staff:,}")
        print(f"   Remote: {remote_staff:,}")
        print(f"   Difference: {local_staff - remote_staff:,}")

asyncio.run(check_borrower_type_mismatch())
