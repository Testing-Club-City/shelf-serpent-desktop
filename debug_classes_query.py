#!/usr/bin/env python3

import requests
import json

def debug_classes_query():
    """Debug the exact classes query to match UI behavior"""
    
    supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    print("Debug: Testing different classes queries...")
    
    # Test 1: Basic query without count
    print("\n1. Basic query without count:")
    response = requests.get(f"{supabase_url}/rest/v1/classes", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Records found: {len(data)}")
        if data:
            print(f"   First record keys: {list(data[0].keys())}")
    
    # Test 2: Query with count=exact
    print("\n2. Query with count=exact:")
    headers_count = headers.copy()
    headers_count["Prefer"] = "count=exact"
    response = requests.get(f"{supabase_url}/rest/v1/classes", headers=headers_count)
    print(f"   Status: {response.status_code}")
    print(f"   Content-Range: {response.headers.get('content-range', 'Not found')}")
    if response.status_code in [200, 206]:
        data = response.json()
        print(f"   Records found: {len(data)}")
    
    # Test 3: Query with select=*
    print("\n3. Query with select=*:")
    response = requests.get(
        f"{supabase_url}/rest/v1/classes",
        headers=headers_count,
        params={"select": "*"}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Content-Range: {response.headers.get('content-range', 'Not found')}")
    if response.status_code in [200, 206]:
        data = response.json()
        print(f"   Records found: {len(data)}")
    
    # Test 4: Check if there are any filters being applied
    print("\n4. Query with no filters at all:")
    response = requests.get(
        f"{supabase_url}/rest/v1/classes",
        headers=headers,
        timeout=30
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response headers: {dict(response.headers)}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Records found: {len(data)}")
        if data:
            print(f"   Sample record: {json.dumps(data[0], indent=2)}")
    else:
        print(f"   Error response: {response.text}")

if __name__ == "__main__":
    debug_classes_query()