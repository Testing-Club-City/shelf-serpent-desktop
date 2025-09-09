#!/usr/bin/env python3
"""
Tool to show actual Supabase classes with real names
Usage: python show_actual_classes.py
"""

import requests
import json

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def show_actual_classes():
    """Show actual Supabase classes with real names"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    print("🔍 SUPABASE CLASSES - ACTUAL NAMES")
    print("=" * 50)
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/classes?select=*",
            headers=headers
        )
        
        if response.status_code == 200:
            classes = response.json()
            
            print(f"✅ Found {len(classes)} classes")
            print()
            
            if classes:
                print("📋 ACTUAL CLASS NAMES:")
                print("-" * 30)
                
                for i, cls in enumerate(classes, 1):
                    class_name = cls.get('class_name', 'Unnamed')
                    form_level = cls.get('form_level', 'N/A')
                    class_section = cls.get('class_section', '')
                    max_books = cls.get('max_books_allowed', 2)
                    is_active = '✅ Active' if cls.get('is_active', True) else '❌ Inactive'
                    
                    full_name = f"Form {form_level}{class_section}" if class_section else f"Form {form_level}"
                    
                    print(f"{i:2d}. {class_name} ({full_name})")
                    print(f"    Books allowed: {max_books}")
                    print(f"    Status: {is_active}")
                    print()
                
                # Summary by form level
                form_levels = {}
                for cls in classes:
                    level = cls.get('form_level', 'Unknown')
                    form_levels[level] = form_levels.get(level, 0) + 1
                
                print("📊 SUMMARY BY FORM LEVEL:")
                print("-" * 30)
                for level, count in sorted(form_levels.items()):
                    print(f"  Form {level}: {count} classes")
                
            else:
                print("❌ No classes found")
                
        else:
            print(f"❌ Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    show_actual_classes()
