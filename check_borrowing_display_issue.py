#!/usr/bin/env python3
"""
Check if the issue is with borrowing display - all showing as students
"""

import asyncio
import sqlite3
import httpx

async def check_borrowing_display():
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    print("🔍 Checking borrowing display data...")
    
    # Get sample borrowings from remote with all relevant fields
    async with httpx.AsyncClient() as client:
        # Get mixed sample of student and staff borrowings
        resp = await client.get(
            f"{base_url}/borrowings?limit=10&select=id,borrower_type,student_id,staff_id",
            headers=headers
        )
        sample_borrowings = resp.json()
        
        print(f"\n📋 SAMPLE BORROWINGS FROM REMOTE:")
        print(f"{'ID':<40} {'Type':<8} {'Student ID':<40} {'Staff ID'}")
        print("-" * 130)
        
        student_count = 0
        staff_count = 0
        
        for borrowing in sample_borrowings:
            borrower_type = borrowing.get('borrower_type', 'unknown')
            student_id = borrowing.get('student_id', 'null')
            staff_id = borrowing.get('staff_id', 'null')
            
            if borrower_type == 'student':
                student_count += 1
            elif borrower_type == 'staff':
                staff_count += 1
            
            print(f"{borrowing['id']:<40} {borrower_type:<8} {student_id:<40} {staff_id}")
        
        print(f"\nIn this sample:")
        print(f"  Student borrowings: {student_count}")
        print(f"  Staff borrowings: {staff_count}")
        
        # Check if all borrowings are incorrectly marked as student
        resp = await client.get(
            f"{base_url}/borrowings?borrower_type=eq.student&select=count",
            headers={**headers, "Prefer": "count=exact"}
        )
        all_student_count = int(resp.headers.get("content-range", "0").split("/")[-1])
        
        resp = await client.get(
            f"{base_url}/borrowings?select=count",
            headers={**headers, "Prefer": "count=exact"}
        )
        total_count = int(resp.headers.get("content-range", "0").split("/")[-1])
        
        print(f"\n📊 REMOTE DATABASE TOTALS:")
        print(f"  Total borrowings: {total_count:,}")
        print(f"  Marked as 'student': {all_student_count:,}")
        print(f"  Marked as 'staff': {total_count - all_student_count:,}")
        
        if all_student_count == total_count:
            print(f"\n🚨 ISSUE CONFIRMED: All {total_count:,} borrowings are marked as 'student'!")
            print(f"   This means staff borrowings are incorrectly classified.")
        else:
            print(f"\n✅ Classification looks correct - mixed borrower types found.")

asyncio.run(check_borrowing_display())
