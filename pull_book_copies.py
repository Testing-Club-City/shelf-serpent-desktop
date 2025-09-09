#!/usr/bin/env python3
"""
Script to pull all book copies data from Supabase
Usage: python pull_book_copies.py
"""

import requests
import json
import csv
from datetime import datetime
import os

# Supabase configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def pull_book_copies():
    """Pull all book copies data from Supabase"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    print("📚 Pulling Book Copies Data from Supabase...")
    print(f"URL: {SUPABASE_URL}")
    print("-" * 60)
    
    try:
        # First, get the total count
        count_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/book_copies?select=*",
            headers={**headers, "Prefer": "count=exact"},
            params={"limit": 0}
        )
        
        if count_response.status_code == 200:
            total_count = count_response.headers.get('Content-Range', '0').split('/')[-1]
            print(f"📊 Total book copies found: {total_count}")
        else:
            print(f"❌ Failed to get count: {count_response.status_code}")
            print(f"Response: {count_response.text}")
            return
        
        # Pull all data (Supabase has a default limit, so we'll use a large limit)
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/book_copies?select=*&limit=10000",
            headers=headers
        )
        
        if response.status_code == 200:
            book_copies = response.json()
            print(f"✅ Successfully retrieved {len(book_copies)} book copies")
            
            # Display sample data
            if book_copies:
                print("\n📋 Sample Data (first 3 records):")
                print("-" * 60)
                for i, copy in enumerate(book_copies[:3]):
                    print(f"Record {i+1}:")
                    for key, value in copy.items():
                        print(f"  {key}: {value}")
                    print()
                
                # Show column structure
                print("📊 Column Structure:")
                print("-" * 60)
                if book_copies:
                    columns = list(book_copies[0].keys())
                    for i, col in enumerate(columns, 1):
                        print(f"{i:2d}. {col}")
                
                # Save to JSON file
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                json_filename = f"book_copies_data_{timestamp}.json"
                
                with open(json_filename, 'w', encoding='utf-8') as f:
                    json.dump(book_copies, f, indent=2, ensure_ascii=False, default=str)
                
                print(f"\n💾 Data saved to: {json_filename}")
                
                # Save to CSV file
                csv_filename = f"book_copies_data_{timestamp}.csv"
                
                if book_copies:
                    with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.DictWriter(f, fieldnames=book_copies[0].keys())
                        writer.writeheader()
                        writer.writerows(book_copies)
                    
                    print(f"💾 Data also saved to: {csv_filename}")
                
                # Summary statistics
                print(f"\n📈 Summary:")
                print(f"  Total records: {len(book_copies)}")
                print(f"  Columns: {len(columns)}")
                print(f"  File size (JSON): {os.path.getsize(json_filename)} bytes")
                print(f"  File size (CSV): {os.path.getsize(csv_filename)} bytes")
                
                # Check for specific fields of interest
                if book_copies:
                    sample = book_copies[0]
                    interesting_fields = ['id', 'book_id', 'copy_number', 'barcode', 'status', 'condition', 'location']
                    print(f"\n🔍 Key Fields Present:")
                    for field in interesting_fields:
                        status = "✅" if field in sample else "❌"
                        print(f"  {status} {field}")
                
            else:
                print("⚠️  No book copies found in the database")
                
        else:
            print(f"❌ Failed to retrieve book copies: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def check_table_exists():
    """Check if book_copies table exists"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    try:
        # Try to get table schema info
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/book_copies?select=*&limit=1",
            headers=headers
        )
        
        if response.status_code == 200:
            print("✅ book_copies table exists and is accessible")
            return True
        elif response.status_code == 404:
            print("❌ book_copies table not found")
            return False
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking table: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Book Copies Data Pull...")
    print("=" * 60)
    
    # Check if table exists first
    if check_table_exists():
        pull_book_copies()
    else:
        print("\n💡 Tip: Make sure the table name is correct. Common variations:")
        print("  - book_copies")
        print("  - bookcopies") 
        print("  - copies")
        print("  - book_copy")
    
    print("\n✨ Script completed!")
