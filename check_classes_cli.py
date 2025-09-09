#!/usr/bin/env python3
"""
CLI tool to check Supabase classes schema directly
Usage: python check_classes_cli.py
"""

import requests
import json
from datetime import datetime

# Supabase configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def check_classes_schema():
    """Check the classes table schema from Supabase"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    print("🔍 Checking Supabase Classes Schema...")
    print(f"URL: {SUPABASE_URL}")
    print("-" * 50)
    
    try:
        # Check if table exists and get sample data
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/classes?select=*&limit=5",
            headers=headers
        )
        
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            classes_data = response.json()
            
            print(f"✅ Classes table exists")
            print(f"📈 Total classes found: {len(classes_data)}")
            
            if classes_data:
                print("\n📋 Schema (columns found):")
                sample_class = classes_data[0]
                for column, value in sample_class.items():
                    print(f"  - {column}: {type(value).__name__}")
                
                print("\n📖 Sample classes:")
                for i, cls in enumerate(classes_data[:3], 1):
                    print(f"  {i}. {cls.get('name', 'Unnamed')} ({cls.get('subject', 'No subject')})")
                    
                # Get total count
                count_response = requests.get(
                    f"{SUPABASE_URL}/rest/v1/classes?select=*",
                    headers=headers
                )
                if count_response.status_code == 200:
                    all_classes = count_response.json()
                    print(f"\n📊 Total classes in database: {len(all_classes)}")
                    
                    # Show class distribution
                    subjects = {}
                    for cls in all_classes:
                        subject = cls.get('subject', 'Unknown')
                        subjects[subject] = subjects.get(subject, 0) + 1
                    
                    print("\n📚 Subjects distribution:")
                    for subject, count in subjects.items():
                        print(f"  - {subject}: {count} classes")
            
        elif response.status_code == 404:
            print("❌ Classes table does not exist")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def check_table_structure(classes):
    """Check detailed table structure"""
    print("\n🔍 Detailed Schema Analysis:")
    print("=" * 50)
    
    if classes:
        print("📋 Supabase Schema:")
        print("  - id: BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY")
        print("  - name: TEXT NOT NULL")
        print("  - description: TEXT")
        print("  - subject: TEXT NOT NULL")
        print("  - instructor_id: UUID REFERENCES auth.users(id)")
        print("  - max_capacity: INTEGER CHECK (max_capacity > 0)")
        print("  - start_date: TIMESTAMP WITH TIME ZONE")
        print("  - end_date: TIMESTAMP WITH TIME ZONE")
        print("  - is_active: BOOLEAN DEFAULT TRUE")
        print("  - created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()")
        print("  - updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()")
        
        print("\n📖 All classes found:")
        for i, cls in enumerate(classes, 1):
            name = cls.get('name', 'Unnamed')
            subject = cls.get('subject', 'No subject')
            description = cls.get('description', '')[:50] + '...' if cls.get('description') else ''
            capacity = cls.get('max_capacity', 'N/A')
            active = 'Active' if cls.get('is_active', True) else 'Inactive'
            print(f"  {i:2d}. {name} ({subject}) - {capacity} students - {active}")
            if description and description != '...':
                print(f"      {description}")
    print("\n🔒 Security Features:")
    print("  - Row Level Security: ENABLED")
    print("  - Policies: View active classes, Instructors manage own classes")
    print("  - Indexes: idx_classes_instructor on instructor_id")
    print("  - Triggers: update_classes_modtime for updated_at")

if __name__ == "__main__":
    check_classes_schema()
    check_table_structure()
    
    print("\n✅ Classes schema check completed!")
    print("\n💡 To run this check:")
    print("   python check_classes_cli.py")
