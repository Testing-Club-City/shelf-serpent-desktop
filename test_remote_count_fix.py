#!/usr/bin/env python3
"""
Test the remote count fix for classes in bidirectional sync
"""

import requests
import json

def test_remote_count_methods():
    """Test different methods of getting remote count"""
    
    SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    print("TESTING REMOTE COUNT METHODS FOR CLASSES")
    print("=" * 60)
    
    # Method 1: HEAD request with select=count (OLD - BROKEN)
    print("\n1. OLD METHOD (HEAD with select=count):")
    try:
        url1 = f"{SUPABASE_URL}/rest/v1/classes?select=count"
        headers1 = headers.copy()
        headers1["Prefer"] = "count=exact"
        
        response1 = requests.head(url1, headers=headers1, timeout=10)
        print(f"   Status: {response1.status_code}")
        print(f"   Headers: {dict(response1.headers)}")
        
        if "content-range" in response1.headers:
            count_str = response1.headers["content-range"]
            print(f"   Content-Range: {count_str}")
            if "/" in count_str:
                count = count_str.split("/")[1]
                print(f"   Extracted Count: {count}")
            else:
                print("   No count found in content-range")
        else:
            print("   No content-range header")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    # Method 2: GET request with select=id (NEW - WORKING)
    print("\n2. NEW METHOD (GET with select=id):")
    try:
        url2 = f"{SUPABASE_URL}/rest/v1/classes?select=id"
        headers2 = headers.copy()
        headers2["Prefer"] = "count=exact"
        
        response2 = requests.get(url2, headers=headers2, timeout=10)
        print(f"   Status: {response2.status_code}")
        
        if "content-range" in response2.headers:
            count_str = response2.headers["content-range"]
            print(f"   Content-Range: {count_str}")
            if "/" in count_str:
                count = count_str.split("/")[1]
                print(f"   Extracted Count: {count}")
            else:
                print("   No count found in content-range")
        else:
            print("   No content-range header")
            
        # Also check the actual data
        data = response2.json()
        print(f"   Actual records returned: {len(data)}")
        
    except Exception as e:
        print(f"   Error: {e}")
    
    # Method 3: Direct count query
    print("\n3. DIRECT COUNT QUERY:")
    try:
        url3 = f"{SUPABASE_URL}/rest/v1/classes?select=count(*)"
        
        response3 = requests.get(url3, headers=headers, timeout=10)
        print(f"   Status: {response3.status_code}")
        
        if response3.status_code == 200:
            data = response3.json()
            print(f"   Response: {data}")
        else:
            print(f"   Error response: {response3.text}")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\nCONCLUSION:")
    print("The NEW METHOD (GET with select=id) should work correctly")
    print("This matches the professional sync implementation")

if __name__ == "__main__":
    test_remote_count_methods()