#!/usr/bin/env python3
import asyncio
import httpx

SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

async def check_book_copies_schema():
    async with httpx.AsyncClient() as client:
        # Try to insert a minimal record to see schema requirements
        test_data = {
            "id": "test-123",
            "title": "Test Book",
            "author": "Test Author",
            "copy_identifier": "TEST-001",
            "status": "available"
        }
        
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/book_copies",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            },
            json=test_data
        )
        
        print(f"Test insert response: {response.status_code}")
        print(f"Response: {response.text}")
        
        # Check existing records
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/book_copies?limit=1",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print("\nExisting book_copies columns:")
                for col in sorted(data[0].keys()):
                    print(f"  - {col}")
            else:
                print("\nbook_copies table is empty")

if __name__ == "__main__":
    asyncio.run(check_book_copies_schema())