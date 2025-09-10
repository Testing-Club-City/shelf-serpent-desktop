#!/usr/bin/env python3
import asyncio
import httpx
import json

# Supabase credentials
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

async def check_tables():
    tables = ["borrowings", "students", "books", "staff", "classes", "categories", "book_copies", "fines"]
    
    async with httpx.AsyncClient() as client:
        print("Checking Supabase Tables:\n")
        
        for table in tables:
            try:
                response = await client.get(
                    f"{SUPABASE_URL}/rest/v1/{table}",
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
                    },
                    params={"limit": 1}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        columns = list(data[0].keys())
                        print(f"OK {table} ({len(columns)} columns):")
                        for col in sorted(columns):
                            print(f"   - {col}")
                        print()
                    else:
                        print(f"OK {table} (empty)")
                else:
                    print(f"ERROR {table} - Error {response.status_code}")
            except Exception as e:
                print(f"ERROR {table} - Exception: {e}")

async def check_borrowings_detail():
    async with httpx.AsyncClient() as client:
        print("\nBorrowings Table Detail:\n")
        
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
                sample = data[0]
                print("Sample record structure:")
                for key, value in sample.items():
                    value_type = type(value).__name__
                    print(f"  {key}: {value_type} = {value}")
            else:
                print("Table is empty")
        else:
            print(f"Error: {response.status_code}")

if __name__ == "__main__":
    asyncio.run(check_tables())
    asyncio.run(check_borrowings_detail())