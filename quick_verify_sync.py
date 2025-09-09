#!/usr/bin/env python3
"""
Quick sync verification using counts only
"""

import asyncio
import sqlite3
import httpx

async def quick_verify():
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    
    local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    print("🔍 Quick Sync Verification...")
    
    # Local counts
    conn = sqlite3.connect(local_db)
    local_total = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
    local_student = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
    local_staff = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
    conn.close()
    
    # Remote counts
    async with httpx.AsyncClient() as client:
        # Total borrowings
        resp = await client.get(f"{base_url}/borrowings?select=count", headers=headers)
        remote_total = int(resp.headers.get("content-range", "0").split("/")[-1])
        
        # Student borrowings
        resp = await client.get(f"{base_url}/borrowings?borrower_type=eq.student&select=count", headers=headers)
        remote_student = int(resp.headers.get("content-range", "0").split("/")[-1])
        
        # Staff borrowings
        resp = await client.get(f"{base_url}/borrowings?borrower_type=eq.staff&select=count", headers=headers)
        remote_staff = int(resp.headers.get("content-range", "0").split("/")[-1])
    
    print(f"\n📊 BORROWINGS SYNC STATUS:")
    print(f"{'Type':<15} {'Local':<10} {'Remote':<10} {'Sync %':<10} {'Status'}")
    print("-" * 55)
    
    total_sync = round((remote_total/local_total)*100, 2) if local_total else 0
    student_sync = round((remote_student/local_student)*100, 2) if local_student else 0
    staff_sync = round((remote_staff/local_staff)*100, 2) if local_staff else 0
    
    print(f"{'Total':<15} {local_total:<10} {remote_total:<10} {total_sync:<10} {'✅' if total_sync > 99 else '❌'}")
    print(f"{'Student':<15} {local_student:<10} {remote_student:<10} {student_sync:<10} {'✅' if student_sync > 99 else '❌'}")
    print(f"{'Staff':<15} {local_staff:<10} {remote_staff:<10} {staff_sync:<10} {'✅' if staff_sync > 99 else '❌'}")
    
    if total_sync > 99.9:
        print(f"\n✅ SYNC STATUS: EXCELLENT - Borrowings are well mapped!")
    elif total_sync > 95:
        print(f"\n⚠️ SYNC STATUS: GOOD - Minor sync issues")
    else:
        print(f"\n❌ SYNC STATUS: POOR - Sync issues detected")

asyncio.run(quick_verify())
