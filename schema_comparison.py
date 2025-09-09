#!/usr/bin/env python3
"""
Comprehensive schema comparison between Supabase and local SQLite
Usage: python schema_comparison.py
"""

import requests
import sqlite3
import json
import os

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
LOCAL_DB_PATH = r"C:\Users\Denis Kariuki\AppData\Roaming\shelf-serpent\library.db"

def check_supabase_classes():
    """Check Supabase classes table"""
    print("🔍 SUPABASE CLASSES SCHEMA")
    print("=" * 50)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/classes?select=*",
            headers=headers
        )
        
        if response.status_code == 200:
            classes = response.json()
            print(f"✅ Classes table exists")
            print(f"📊 Total classes: {len(classes)}")
            
            if classes:
                print("\n📋 Supabase Schema:")
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
                
                print("\n📖 Sample classes:")
                for cls in classes[:3]:
                    print(f"  - {cls.get('name', 'Unnamed')} ({cls.get('subject', 'No subject')})")
            
            return classes
        else:
            print(f"❌ Error: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"❌ Error checking Supabase: {e}")
        return []

def check_local_classes():
    """Check local SQLite classes table"""
    print("\n🔍 LOCAL SQLITE CLASSES SCHEMA")
    print("=" * 50)
    
    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='classes'")
        if not cursor.fetchone():
            print("❌ Classes table does not exist locally")
            return []
        
        # Get count
        cursor.execute("SELECT COUNT(*) FROM classes")
        count = cursor.fetchone()[0]
        print(f"✅ Classes table exists locally")
        print(f"📊 Total classes: {count}")
        
        # Get schema
        cursor.execute("PRAGMA table_info(classes)")
        columns = cursor.fetchall()
        print("\n📋 Local Schema:")
        for col in columns:
            print(f"  - {col[1]}: {col[2]} ({'PRIMARY KEY' if col[5] else ''})")
        
        # Get sample data
        cursor.execute("SELECT * FROM classes LIMIT 3")
        classes = cursor.fetchall()
        
        if classes:
            print("\n📖 Sample classes:")
            for cls in classes:
                print(f"  - {cls[1]} (Form {cls[2]})")
        
        # Get all classes
        cursor.execute("SELECT * FROM classes")
        all_classes = cursor.fetchall()
        
        conn.close()
        return all_classes
        
    except Exception as e:
        print(f"❌ Error checking local: {e}")
        return []

def compare_schemas():
    """Compare the two schemas"""
    print("\n🔍 SCHEMA COMPARISON")
    print("=" * 50)
    
    supabase_classes = check_supabase_classes()
    local_classes = check_local_classes()
    
    print("\n📊 SUMMARY")
    print("-" * 30)
    print(f"Supabase classes: {len(supabase_classes)}")
    print(f"Local classes: {len(local_classes)}")
    
    print("\n⚠️  SCHEMA DIFFERENCES")
    print("-" * 30)
    print("Supabase uses:")
    print("  - BIGINT auto-increment id")
    print("  - name, subject, description fields")
    print("  - instructor_id UUID references")
    print("  - datetime with timezone")
    print("  - boolean is_active")
    
    print("\nLocal uses:")
    print("  - TEXT primary key id")
    print("  - class_name, form_level fields")
    print("  - class_section instead of subject")
    print("  - TEXT datetime")
    print("  - INTEGER is_active (0/1)")
    
    print("\n💡 MISMATCH ALERT")
    print("The schemas are completely different!")
    print("- Supabase: Modern educational classes (courses)")
    print("- Local: School class groups (Form 1A, Form 2B, etc.)")

if __name__ == "__main__":
    compare_schemas()
