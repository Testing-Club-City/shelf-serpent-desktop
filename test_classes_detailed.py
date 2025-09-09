#!/usr/bin/env python3

import requests
import json

def test_classes_detailed():
    """Test different ways to query classes from Supabase"""
    
    supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}"
    }
    
    print("Testing different ways to query classes...")
    
    # Test 1: Simple GET request
    print("\n1. Simple GET request:")
    url1 = f"{supabase_url}/rest/v1/classes"
    response = requests.get(url1, headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Classes found: {len(data)}")
        if data:
            print(f"   First class: {data[0]}")
    else:
        print(f"   Error: {response.text}")
    
    # Test 2: GET with count header
    print("\n2. GET with count header:")
    headers_with_count = headers.copy()
    headers_with_count["Prefer"] = "count=exact"
    
    url2 = f"{supabase_url}/rest/v1/classes?select=id&limit=1"
    response = requests.get(url2, headers=headers_with_count)
    print(f"   Status: {response.status_code}")
    print(f"   Headers: {dict(response.headers)}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Data: {data}")
    
    # Test 3: HEAD request (like the professional sync manager)
    print("\n3. HEAD request (like professional sync manager):")
    url3 = f"{supabase_url}/rest/v1/classes?select=id&is_active=eq.true&limit=1"
    response = requests.head(url3, headers=headers_with_count, timeout=10)
    print(f"   Status: {response.status_code}")
    print(f"   Content-Range: {response.headers.get('content-range', 'Not found')}")
    
    # Test 4: Check if table exists
    print("\n4. Check table schema:")
    url4 = f"{supabase_url}/rest/v1/"
    response = requests.get(url4, headers=headers)
    print(f"   Status: {response.status_code}")
    
    # Test 5: Try different table names
    print("\n5. Try different possible table names:")
    possible_names = ["classes", "class", "student_classes", "school_classes"]
    for name in possible_names:
        url = f"{supabase_url}/rest/v1/{name}?limit=1"
        response = requests.get(url, headers=headers)
        print(f"   {name}: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"      Found {len(data)} records")

if __name__ == "__main__":
    test_classes_detailed()