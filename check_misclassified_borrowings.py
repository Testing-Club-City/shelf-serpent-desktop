#!/usr/bin/env python3
"""
Check for misclassified borrowings - student borrowings that should be staff
"""

import asyncio
import sqlite3
import httpx

async def check_misclassified_borrowings():
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    print("🔍 Checking for misclassified borrowings...")
    
    # Check local database for potential misclassifications
    conn = sqlite3.connect(local_db)
    
    # Find student borrowings that have staff_id (should be staff borrowings)
    misclassified_local = conn.execute("""
        SELECT id, student_id, staff_id, borrower_type 
        FROM borrowings 
        WHERE borrower_type = 'student' AND staff_id IS NOT NULL
        LIMIT 10
    """).fetchall()
    
    # Find staff borrowings that have student_id (should be student borrowings)
    reverse_misclassified = conn.execute("""
        SELECT id, student_id, staff_id, borrower_type 
        FROM borrowings 
        WHERE borrower_type = 'staff' AND student_id IS NOT NULL
        LIMIT 10
    """).fetchall()
    
    conn.close()
    
    print(f"\n📋 LOCAL MISCLASSIFICATION CHECK:")
    print(f"Student borrowings with staff_id: {len(misclassified_local)}")
    print(f"Staff borrowings with student_id: {len(reverse_misclassified)}")
    
    if misclassified_local:
        print(f"\n❌ MISCLASSIFIED AS STUDENT (should be staff):")
        for rec in misclassified_local[:5]:
            print(f"  ID: {rec[0]} | borrower_type: {rec[3]} | staff_id: {rec[2]}")
    
    if reverse_misclassified:
        print(f"\n❌ MISCLASSIFIED AS STAFF (should be student):")
        for rec in reverse_misclassified[:5]:
            print(f"  ID: {rec[0]} | borrower_type: {rec[3]} | student_id: {rec[1]}")
    
    # Check remote database for same issues
    async with httpx.AsyncClient() as client:
        # Check remote for student borrowings with staff_id
        resp = await client.get(
            f"{base_url}/borrowings?borrower_type=eq.student&staff_id=not.is.null&limit=10&select=id,borrower_type,staff_id,student_id",
            headers=headers
        )
        remote_misclassified = resp.json()
        
        # Check remote for staff borrowings with student_id
        resp = await client.get(
            f"{base_url}/borrowings?borrower_type=eq.staff&student_id=not.is.null&limit=10&select=id,borrower_type,staff_id,student_id",
            headers=headers
        )
        remote_reverse_misclassified = resp.json()
    
    print(f"\n📋 REMOTE MISCLASSIFICATION CHECK:")
    print(f"Student borrowings with staff_id: {len(remote_misclassified)}")
    print(f"Staff borrowings with student_id: {len(remote_reverse_misclassified)}")
    
    if remote_misclassified:
        print(f"\n❌ REMOTE MISCLASSIFIED AS STUDENT (should be staff):")
        for rec in remote_misclassified[:5]:
            print(f"  ID: {rec['id']} | borrower_type: {rec['borrower_type']} | staff_id: {rec['staff_id']}")
    
    if remote_reverse_misclassified:
        print(f"\n❌ REMOTE MISCLASSIFIED AS STAFF (should be student):")
        for rec in remote_reverse_misclassified[:5]:
            print(f"  ID: {rec['id']} | borrower_type: {rec['borrower_type']} | student_id: {rec['student_id']}")
    
    # Summary
    total_local_issues = len(misclassified_local) + len(reverse_misclassified)
    total_remote_issues = len(remote_misclassified) + len(remote_reverse_misclassified)
    
    if total_local_issues > 0 or total_remote_issues > 0:
        print(f"\n🚨 CLASSIFICATION ISSUES FOUND!")
        print(f"   Local issues: {total_local_issues}")
        print(f"   Remote issues: {total_remote_issues}")
        print(f"\n💡 SOLUTION: Fix borrower_type based on which ID is populated:")
        print(f"   - If staff_id exists → borrower_type = 'staff'")
        print(f"   - If student_id exists → borrower_type = 'student'")
    else:
        print(f"\n✅ NO CLASSIFICATION ISSUES FOUND")

asyncio.run(check_misclassified_borrowings())
