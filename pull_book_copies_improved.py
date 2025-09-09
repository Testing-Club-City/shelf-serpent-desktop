#!/usr/bin/env python3
"""
Improved script to pull all book copies data from Supabase
Usage: python pull_book_copies_improved.py
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
        # Try to pull data directly without count first
        print("🔄 Fetching book copies data...")
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/book_copies?select=*",
            headers=headers
        )
        
        print(f"📡 Response Status: {response.status_code}")
        print(f"📡 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            book_copies = response.json()
            print(f"✅ Successfully retrieved {len(book_copies)} book copies")
            
            if book_copies:
                # Display sample data
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
                sample = book_copies[0]
                interesting_fields = ['id', 'book_id', 'copy_number', 'barcode', 'status', 'condition', 'location', 'created_at', 'updated_at']
                print(f"\n🔍 Key Fields Present:")
                for field in interesting_fields:
                    status = "✅" if field in sample else "❌"
                    print(f"  {status} {field}")
                
                # Show some statistics
                if len(book_copies) > 0:
                    print(f"\n📊 Data Statistics:")
                    
                    # Status distribution if status field exists
                    if 'status' in sample:
                        status_counts = {}
                        for copy in book_copies:
                            status = copy.get('status', 'unknown')
                            status_counts[status] = status_counts.get(status, 0) + 1
                        
                        print(f"  Status Distribution:")
                        for status, count in status_counts.items():
                            print(f"    {status}: {count}")
                    
                    # Book ID distribution
                    if 'book_id' in sample:
                        book_ids = set(copy.get('book_id') for copy in book_copies if copy.get('book_id'))
                        print(f"  Unique Books: {len(book_ids)}")
                
            else:
                print("⚠️  The book_copies table exists but contains no data")
                
        elif response.status_code == 404:
            print("❌ book_copies table not found")
            print("💡 Let's check what tables are available...")
            check_available_tables()
            
        else:
            print(f"❌ Failed to retrieve book copies: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
        print(f"Raw response: {response.text}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def check_available_tables():
    """Check what tables are available in the database"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    # Common table names to check
    possible_tables = [
        'book_copies', 'bookcopies', 'copies', 'book_copy',
        'books', 'students', 'borrowings', 'categories',
        'staff', 'fines', 'system_logs'
    ]
    
    print("\n🔍 Checking available tables...")
    print("-" * 40)
    
    available_tables = []
    
    for table in possible_tables:
        try:
            response = requests.get(
                f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1",
                headers=headers
            )
            
            if response.status_code == 200:
                available_tables.append(table)
                print(f"✅ {table}")
            elif response.status_code == 404:
                print(f"❌ {table}")
            else:
                print(f"⚠️  {table} (status: {response.status_code})")
                
        except Exception as e:
            print(f"❌ {table} (error: {e})")
    
    if available_tables:
        print(f"\n📋 Available tables: {', '.join(available_tables)}")
    else:
        print("\n⚠️  No tables found or accessible")

def check_table_schema(table_name):
    """Check the schema of a specific table"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=1",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"\n📊 Schema for '{table_name}':")
                print("-" * 40)
                for key in data[0].keys():
                    print(f"  - {key}")
            else:
                print(f"\n⚠️  Table '{table_name}' exists but is empty")
        else:
            print(f"\n❌ Cannot access table '{table_name}': {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ Error checking schema for '{table_name}': {e}")

if __name__ == "__main__":
    print("🚀 Starting Improved Book Copies Data Pull...")
    print("=" * 60)
    
    # First check available tables
    check_available_tables()
    
    # Then try to pull book_copies data
    pull_book_copies()
    
    print("\n✨ Script completed!")
