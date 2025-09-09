#!/usr/bin/env python3
"""
Fix the sync issue by uploading missing students to Supabase
"""

import asyncio
import sqlite3
import httpx
import json
from typing import List, Dict

class SyncFixer:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        self.local_db = "/home/deniskariuki/.local/share/library-management-system/library.db"

    def get_missing_students(self) -> List[str]:
        """Get student IDs that exist in borrowings but not in Supabase"""
        missing_students = [
            "7485e491-3ced-4ec5-b11e-64ff8fcf777d",
            "b43decd1-9084-43a1-a0f3-577308e33f00",
            "8110c1ea-8445-4dea-9341-13430bb50801",
            "8a6ae344-d459-4dfc-83cf-1c0d5a288db2",
            "49757b9c-76bd-487c-9533-6be4b8a56e99"
        ]
        return missing_students[:5]  # Start with first 5

    def get_local_students(self, student_ids: List[str]) -> List[Dict]:
        """Get student data from local database"""
        conn = sqlite3.connect(self.local_db)
        conn.row_factory = sqlite3.Row
        
        placeholders = ','.join(['?' for _ in student_ids])
        query = f"SELECT * FROM students WHERE id IN ({placeholders})"
        
        cursor = conn.execute(query, student_ids)
        students = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return students

    async def get_existing_student_ids(self) -> set:
        """Get existing student IDs from Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/students?select=id",
                headers=self.headers
            )
            existing = response.json()
            return {s["id"] for s in existing}

    async def upload_students(self, students: List[Dict]) -> bool:
        """Upload only new students to Supabase"""
        try:
            existing_ids = await self.get_existing_student_ids()
            new_students = [s for s in students if s["id"] not in existing_ids]
            
            if not new_students:
                print(f"ℹ️ All {len(students)} students already exist in Supabase")
                return True
                
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/students",
                    headers=self.headers,
                    json=new_students
                )
                
                if response.status_code in [200, 201]:
                    print(f"✅ Successfully uploaded {len(new_students)} new students")
                    print(f"ℹ️ Skipped {len(students) - len(new_students)} existing students")
                    return True
                else:
                    print(f"❌ Failed to upload students: {response.status_code}")
                    return False
                    
        except Exception as e:
            print(f"❌ Error uploading students: {e}")
            return False

    async def check_students_count(self) -> int:
        """Check current students count in Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/students?select=count",
                headers={**self.headers, "Prefer": "count=exact"}
            )
            count_header = response.headers.get("content-range", "0")
            return int(count_header.split("/")[-1]) if "/" in count_header else 0

async def main():
    fixer = SyncFixer()
    
    print("🔧 Starting Sync Fix Process...")
    
    # Check current state
    current_count = await fixer.check_students_count()
    print(f"📊 Current students in Supabase: {current_count}")
    print(f"📊 Students needed locally: 5,889")
    
    # Get missing students
    missing_ids = fixer.get_missing_students()
    print(f"\n🔍 Checking {len(missing_ids)} missing student IDs...")
    
    # Get their data from local DB
    local_students = fixer.get_local_students(missing_ids)
    print(f"📋 Found {len(local_students)} students in local database")
    
    if local_students:
        print(f"\n📤 Uploading students to Supabase...")
        success = await fixer.upload_students(local_students)
        
        if success:
            new_count = await fixer.check_students_count()
            print(f"✅ New students count in Supabase: {new_count}")
            print(f"\n🎯 Next Steps:")
            print(f"   1. Run this script with more student IDs")
            print(f"   2. Upload all 5,889 students from local to Supabase")
            print(f"   3. Then borrowings sync will work on Windows")
        else:
            print(f"❌ Upload failed. Check your Supabase permissions.")

if __name__ == "__main__":
    asyncio.run(main())
