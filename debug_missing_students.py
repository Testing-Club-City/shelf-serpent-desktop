#!/usr/bin/env python3
import asyncio
import httpx

async def check_specific_students():
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    missing_id = "7485e491-3ced-4ec5-b11e-64ff8fcf777d"
    
    async with httpx.AsyncClient() as client:
        # Check if student exists
        response = await client.get(
            f"{base_url}/students?id=eq.{missing_id}",
            headers=headers
        )
        students = response.json()
        print(f"Student {missing_id} exists: {len(students) > 0}")
        
        # Check borrowings with this student
        response = await client.get(
            f"{base_url}/borrowings?student_id=eq.{missing_id}&limit=3",
            headers=headers
        )
        borrowings = response.json()
        print(f"Borrowings for this student: {len(borrowings)}")

asyncio.run(check_specific_students())
