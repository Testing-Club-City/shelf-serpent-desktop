#!/usr/bin/env python3
"""
Check what tables exist in Supabase and their counts
"""

import requests
import json

def check_remote_tables():
    """Check remote tables and their counts"""
    
    SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    
    print("CHECKING REMOTE TABLES AND COUNTS")
    print("=" * 60)
    
    # Tables to check
    tables = [
        "categories", "classes", "fine_settings", "profiles",
        "books", "students", "staff", "book_copies",
        "borrowings", "group_borrowings", "fines", "theft_reports",
        "notifications"
    ]
    
    for table in tables:
        print(f"\n{table.upper()}:")
        try:
            url = f"{SUPABASE_URL}/rest/v1/{table}?select=id"
            
            response = requests.get(url, headers=headers, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                if "content-range" in response.headers:
                    count_str = response.headers["content-range"]
                    print(f"   Content-Range: {count_str}")
                    if "/" in count_str:
                        count = count_str.split("/")[1]
                        print(f"   Count: {count}")
                    else:
                        print("   Count: Unable to parse")
                else:
                    print("   No content-range header")
                
                # Check actual data
                data = response.json()
                print(f"   Records returned: {len(data)}")
                
                # Show first few records if any
                if data and len(data) > 0:
                    print(f"   Sample IDs: {[item.get('id', 'no-id') for item in data[:3]]}")
                    
            else:
                print(f"   Error: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"   Error: {e}")
    
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("Tables with 0 count might be empty or have access restrictions")
    print("Tables with errors might not exist or have permission issues")

if __name__ == "__main__":
    check_remote_tables()