#!/usr/bin/env python3
"""
Check borrower_type mismatch between local and remote
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
    
    local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    print("🔍 Checking borrower_type mismatch...")
    
    # Local counts by borrower_type
    conn = sqlite3.connect(local_db)
    local_student = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
    local_staff = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
    
    # Get sample staff borrowings from local
    staff_sample = conn.execute("""
        SELECT id, student_id, staff_id, borrower_type 
        FROM borrowings 
        WHERE borrower_type = 'staff' 
        LIMIT 5
    """).fetchall()
    conn.close()
    
    # Remote counts by borrower_type
    async with httpx.AsyncClient() as client:
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
        
        # Check specific staff borrowing IDs in remote
        print(f"\n📋 Checking sample staff borrowings in remote:")
        for staff_rec in staff_sample:
            borrowing_id = staff_rec[0]
            resp = await client.get(
                f"{base_url}/borrowings?id=eq.{borrowing_id}&select=id,borrower_type,student_id,staff_id",
                headers=headers
            )
            remote_data = resp.json()
            if remote_data:
                remote_rec = remote_data[0]
                print(f"  ID: {borrowing_id}")
                print(f"    Local:  borrower_type='{staff_rec[3]}', staff_id='{staff_rec[2]}'")
                print(f"    Remote: borrower_type='{remote_rec.get('borrower_type')}', staff_id='{remote_rec.get('staff_id')}'")
                if staff_rec[3] != remote_rec.get('borrower_type'):
                    print(f"    ❌ MISMATCH!")
                else:
                    print(f"    ✅ Match")
            else:
                print(f"  ID: {borrowing_id} - ❌ NOT FOUND in remote")
    
    print(f"\n📊 BORROWER_TYPE COMPARISON:")
    print(f"{'Type':<10} {'Local':<10} {'Remote':<10} {'Match'}")
    print("-" * 40)
    print(f"{'Student':<10} {local_student:<10} {remote_student:<10} {'✅' if local_student == remote_student else '❌'}")
    print(f"{'Staff':<10} {local_staff:<10} {remote_staff:<10} {'✅' if local_staff == remote_staff else '❌'}")
    
    if local_staff != remote_staff:
        print(f"\n❌ ISSUE DETECTED: Staff borrowings count mismatch!")
        print(f"   Local has {local_staff} staff borrowings")
        print(f"   Remote has {remote_staff} staff borrowings")
        print(f"   Difference: {local_staff - remote_staff}")

asyncio.run(check_borrower_type_mismatch())
