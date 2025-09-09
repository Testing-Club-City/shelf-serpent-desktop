#!/usr/bin/env python3

import requests
import json

def test_classes_count():
    """Test the difference between all classes vs active classes"""
    
    supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Prefer": "count=exact"
    }
    
    print("Testing classes count discrepancy...")
    
    # Test 1: Count ALL classes (what sync function does)
    print("\n1. Testing ALL classes count (what sync function pulls):")
    all_classes_url = f"{supabase_url}/rest/v1/classes?select=id&limit=1"
    
    response = requests.get(all_classes_url, headers=headers)
    if response.status_code == 200:
        content_range = response.headers.get('content-range', '')
        if '/' in content_range:
            all_count = content_range.split('/')[-1]
            print(f"   ALL classes count: {all_count}")
        else:
            print(f"   No content-range header found")
    else:
        print(f"   Failed to get all classes: {response.status_code}")
    
    # Test 2: Count ACTIVE classes only (what professional sync manager counts)
    print("\n2. Testing ACTIVE classes count (what professional sync manager counts):")
    active_classes_url = f"{supabase_url}/rest/v1/classes?select=id&is_active=eq.true&limit=1"
    
    response = requests.get(active_classes_url, headers=headers)
    if response.status_code == 200:
        content_range = response.headers.get('content-range', '')
        if '/' in content_range:
            active_count = content_range.split('/')[-1]
            print(f"   ACTIVE classes count: {active_count}")
        else:
            print(f"   No content-range header found")
    else:
        print(f"   Failed to get active classes: {response.status_code}")
    
    # Test 3: Get actual classes data to see the difference
    print("\n3. Getting sample classes data:")
    sample_url = f"{supabase_url}/rest/v1/classes?select=id,class_name,is_active&limit=10"
    
    response = requests.get(sample_url, headers=headers)
    if response.status_code == 200:
        classes = response.json()
        print(f"   Sample classes ({len(classes)} shown):")
        for cls in classes:
            active_status = "ACTIVE" if cls.get('is_active', True) else "INACTIVE"
            print(f"      - {cls.get('class_name', 'Unknown')}: {active_status}")
    else:
        print(f"   Failed to get sample classes: {response.status_code}")
    
    print("\nCONCLUSION:")
    print("   The issue is that the sync function pulls ALL classes (active + inactive)")
    print("   But the professional sync manager only counts ACTIVE classes")
    print("   This creates a discrepancy in the counts!")

if __name__ == "__main__":
    test_classes_count()