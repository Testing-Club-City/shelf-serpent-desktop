#!/usr/bin/env python3
import asyncio
import httpx

# Check what columns actually exist in Supabase borrowings table
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

async def check_borrowings_columns():
    async with httpx.AsyncClient() as client:
        # Try to get schema by inserting empty record (will fail but show expected columns)
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/borrowings",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            json={}
        )
        
        print(f"Insert response: {response.status_code}")
        if response.text:
            print(f"Response: {response.text}")
        
        # Try to get one record to see actual structure
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/borrowings",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            },
            params={"limit": 1}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print("Existing columns:")
                for col in sorted(data[0].keys()):
                    print(f"  - {col}")
            else:
                print("Table is empty - checking with OPTIONS")
                
                # Try OPTIONS to get schema
                response = await client.request(
                    "OPTIONS",
                    f"{SUPABASE_URL}/rest/v1/borrowings",
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
                    }
                )
                print(f"OPTIONS response: {response.status_code}")
                print(f"Headers: {dict(response.headers)}")

if __name__ == "__main__":
    asyncio.run(check_borrowings_columns())