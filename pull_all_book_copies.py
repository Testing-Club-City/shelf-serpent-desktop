#!/usr/bin/env python3
"""
Script to pull ALL book copies data from Supabase with pagination
Usage: python pull_all_book_copies.py
"""

import requests
import json
import csv
from datetime import datetime
import os
import time

# Supabase configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def get_total_count():
    """Get the total count of book copies"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "count=exact"
    }
    
    try:
        response = requests.head(
            f"{SUPABASE_URL}/rest/v1/book_copies",
            headers=headers
        )
        
        if response.status_code == 200:
            content_range = response.headers.get('Content-Range', '')
            if '/' in content_range:
                total = content_range.split('/')[-1]
                return int(total) if total.isdigit() else None
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting count: {e}")
        return None

def pull_all_book_copies():
    """Pull ALL book copies data from Supabase with pagination"""
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    print("📚 Pulling ALL Book Copies Data from Supabase...")
    print(f"URL: {SUPABASE_URL}")
    print("-" * 60)
    
    # Get total count first
    print("🔢 Getting total count...")
    total_count = get_total_count()
    if total_count:
        print(f"📊 Total book copies in database: {total_count}")
    else:
        print("⚠️  Could not determine total count, will fetch until no more data")
    
    all_book_copies = []
    page_size = 1000  # Supabase default limit
    offset = 0
    page = 1
    
    try:
        while True:
            print(f"\n📄 Fetching page {page} (offset: {offset})...")
            
            # Fetch current page
            response = requests.get(
                f"{SUPABASE_URL}/rest/v1/book_copies",
                headers=headers,
                params={
                    "select": "*",
                    "limit": page_size,
                    "offset": offset,
                    "order": "created_at.asc"  # Consistent ordering
                }
            )
            
            if response.status_code == 200:
                page_data = response.json()
                
                if not page_data:  # No more data
                    print("✅ No more data to fetch")
                    break
                
                all_book_copies.extend(page_data)
                print(f"   Retrieved {len(page_data)} records")
                print(f"   Total so far: {len(all_book_copies)}")
                
                # If we got less than page_size, we're done
                if len(page_data) < page_size:
                    print("✅ Reached end of data")
                    break
                
                # Prepare for next page
                offset += page_size
                page += 1
                
                # Small delay to be nice to the API
                time.sleep(0.1)
                
            else:
                print(f"❌ Failed to retrieve page {page}: {response.status_code}")
                print(f"Response: {response.text}")
                break
        
        if all_book_copies:
            print(f"\n🎉 Successfully retrieved ALL {len(all_book_copies)} book copies!")
            
            # Display sample data
            print("\n📋 Sample Data (first 3 records):")
            print("-" * 60)
            for i, copy in enumerate(all_book_copies[:3]):
                print(f"Record {i+1}:")
                for key, value in copy.items():
                    print(f"  {key}: {value}")
                print()
            
            # Show column structure
            print("📊 Column Structure:")
            print("-" * 60)
            columns = list(all_book_copies[0].keys())
            for i, col in enumerate(columns, 1):
                print(f"{i:2d}. {col}")
            
            # Save to JSON file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_filename = f"all_book_copies_data_{timestamp}.json"
            
            with open(json_filename, 'w', encoding='utf-8') as f:
                json.dump(all_book_copies, f, indent=2, ensure_ascii=False, default=str)
            
            print(f"\n💾 Complete data saved to: {json_filename}")
            
            # Save to CSV file
            csv_filename = f"all_book_copies_data_{timestamp}.csv"
            
            with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=all_book_copies[0].keys())
                writer.writeheader()
                writer.writerows(all_book_copies)
            
            print(f"💾 Complete data also saved to: {csv_filename}")
            
            # Summary statistics
            print(f"\n📈 Final Summary:")
            print(f"  Total records: {len(all_book_copies)}")
            print(f"  Columns: {len(columns)}")
            print(f"  File size (JSON): {os.path.getsize(json_filename):,} bytes")
            print(f"  File size (CSV): {os.path.getsize(csv_filename):,} bytes")
            
            # Detailed statistics
            print(f"\n📊 Detailed Statistics:")
            
            # Status distribution
            status_counts = {}
            condition_counts = {}
            book_ids = set()
            
            for copy in all_book_copies:
                # Status
                status = copy.get('status', 'unknown')
                status_counts[status] = status_counts.get(status, 0) + 1
                
                # Condition
                condition = copy.get('condition', 'unknown')
                condition_counts[condition] = condition_counts.get(condition, 0) + 1
                
                # Book IDs
                if copy.get('book_id'):
                    book_ids.add(copy.get('book_id'))
            
            print(f"  Status Distribution:")
            for status, count in sorted(status_counts.items()):
                percentage = (count / len(all_book_copies)) * 100
                print(f"    {status}: {count:,} ({percentage:.1f}%)")
            
            print(f"  Condition Distribution:")
            for condition, count in sorted(condition_counts.items()):
                percentage = (count / len(all_book_copies)) * 100
                print(f"    {condition}: {count:,} ({percentage:.1f}%)")
            
            print(f"  Unique Books: {len(book_ids):,}")
            
            if len(book_ids) > 0:
                avg_copies_per_book = len(all_book_copies) / len(book_ids)
                print(f"  Average copies per book: {avg_copies_per_book:.1f}")
            
            # Date range
            dates = [copy.get('created_at') for copy in all_book_copies if copy.get('created_at')]
            if dates:
                dates.sort()
                print(f"  Date range: {dates[0][:10]} to {dates[-1][:10]}")
            
        else:
            print("⚠️  No book copies found in the database")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    print("🚀 Starting Complete Book Copies Data Pull...")
    print("=" * 60)
    
    start_time = time.time()
    pull_all_book_copies()
    end_time = time.time()
    
    print(f"\n⏱️  Total execution time: {end_time - start_time:.2f} seconds")
    print("\n✨ Script completed!")
