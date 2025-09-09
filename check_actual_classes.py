#!/usr/bin/env python3
"""
Check actual classes data from Supabase with proper display
"""

import requests
import json
import os

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def check_actual_classes():
    """Check actual classes data from Supabase"""
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    
    print("🔍 Checking actual classes from Supabase...")
    
    # Fetch all classes
    url = f"{SUPABASE_URL}/rest/v1/classes?select=*&order=form_level,class_section"
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        return
    
    classes = response.json()
    
    print(f"📊 Found {len(classes)} classes:")
    print("=" * 60)
    
    for i, cls in enumerate(classes, 1):
        class_name = cls.get('class_name', 'Unnamed')
        form_level = cls.get('form_level', 'Unknown')
        class_section = cls.get('class_section', '')
        max_books = cls.get('max_books_allowed', 0)
        is_active = cls.get('is_active', True)
        
        print(f"{i:2d}. {class_name}")
        print(f"    Form: {form_level}{class_section}")
        print(f"    Max Books: {max_books}")
        print(f"    Status: {'Active' if is_active else 'Inactive'}")
        print(f"    ID: {cls.get('id', 'N/A')}")
        print()
    
    # Summary statistics
    form_levels = {}
    for cls in classes:
        form = str(cls.get('form_level', 'Unknown'))
        form_levels[form] = form_levels.get(form, 0) + 1
    
    print("📈 Summary by Form Level:")
    for form, count in sorted(form_levels.items()):
        print(f"   Form {form}: {count} classes")
    
    return classes

if __name__ == "__main__":
    check_actual_classes()
