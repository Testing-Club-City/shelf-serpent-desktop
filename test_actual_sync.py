#!/usr/bin/env python3
"""
Small-scale actual sync test
Tests actual upload of a few records to verify sync functionality
"""
import sqlite3
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime

# Configuration
DB_PATH = "/home/deniskariuki/.local/share/library-management-system/library.db"
SUPABASE_URL = 'https://ddlzenlqkofefdwdefzm.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'

def test_small_sync():
    """Test syncing a few categories to verify the process works"""
    print("🧪 Small-Scale Sync Test")
    print("=" * 30)
    
    # Connect to local database
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get 2 categories for testing
        cursor.execute("SELECT * FROM categories WHERE synced = 0 LIMIT 2")
        categories = cursor.fetchall()
        
        if not categories:
            print("❌ No unsynced categories found for testing")
            return
        
        print(f"📋 Testing sync of {len(categories)} categories...")
        
        for i, category in enumerate(categories, 1):
            print(f"\n🔄 Testing category {i}: {category['name']}")
            
            # Prepare data for upload
            category_data = {
                'id': category['id'],
                'name': category['name'],
                'description': category['description'],
                'created_at': category['created_at'],
                'updated_at': category['updated_at']
            }
            
            # Convert to JSON
            json_data = json.dumps(category_data).encode('utf-8')
            
            # Prepare request
            url = f"{SUPABASE_URL}/rest/v1/categories"
            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            }
            
            try:
                # Make the request
                req = urllib.request.Request(url, data=json_data, headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status in [200, 201]:
                        print(f"  ✅ Successfully uploaded to Supabase")
                        
                        # Mark as synced in local database
                        cursor.execute(
                            "UPDATE categories SET synced = 1 WHERE id = ?",
                            (category['id'],)
                        )
                        conn.commit()
                        print(f"  ✅ Marked as synced in local database")
                        
                    else:
                        print(f"  ❌ Upload failed with status: {response.status}")
                        response_text = response.read().decode('utf-8')
                        print(f"  📄 Response: {response_text[:200]}...")
                        
            except urllib.error.HTTPError as e:
                error_response = e.read().decode('utf-8')
                print(f"  ❌ HTTP Error {e.code}: {error_response[:200]}...")
            except Exception as e:
                print(f"  ❌ Upload error: {e}")
        
        # Verify the sync worked
        print(f"\n🔍 Verification:")
        
        # Check Supabase count
        try:
            url = f"{SUPABASE_URL}/rest/v1/categories?select=count"
            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Prefer': 'count=exact'
            }
            
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                content_range = response.headers.get('Content-Range', '0')
                if '/' in content_range:
                    supabase_count = int(content_range.split('/')[-1])
                    print(f"  ☁️  Supabase categories: {supabase_count}")
                else:
                    print(f"  ⚠️  Could not get Supabase count")
        except Exception as e:
            print(f"  ❌ Error checking Supabase count: {e}")
        
        # Check local synced count
        cursor.execute("SELECT COUNT(*) FROM categories WHERE synced = 1")
        local_synced = cursor.fetchone()[0]
        print(f"  💾 Local synced categories: {local_synced}")
        
        cursor.execute("SELECT COUNT(*) FROM categories WHERE synced = 0")
        local_unsynced = cursor.fetchone()[0]
        print(f"  📤 Local unsynced categories: {local_unsynced}")
        
        print(f"\n✅ Small-scale sync test completed!")
        
    except Exception as e:
        print(f"❌ Test error: {e}")
    finally:
        conn.close()

def test_download_sync():
    """Test downloading data from Supabase"""
    print(f"\n🔄 Testing Download Sync...")
    
    try:
        # Get categories from Supabase
        url = f"{SUPABASE_URL}/rest/v1/categories?limit=3"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                print(f"  ✅ Downloaded {len(data)} categories from Supabase")
                
                if data:
                    print(f"  📋 Sample category: {data[0].get('name', 'Unknown')}")
                    print(f"  🔑 Fields: {list(data[0].keys())}")
                else:
                    print(f"  ℹ️  No categories found in Supabase")
            else:
                print(f"  ❌ Download failed with status: {response.status}")
                
    except Exception as e:
        print(f"  ❌ Download error: {e}")

def main():
    """Main test function"""
    if not os.path.exists(DB_PATH):
        print("❌ Local database not found!")
        return
    
    print("🚀 Bidirectional Sync - Actual Test")
    print("=" * 40)
    
    # Test upload sync
    test_small_sync()
    
    # Test download sync
    test_download_sync()
    
    print(f"\n🎉 Actual sync test completed!")
    print(f"\n💡 If this worked, your full sync should work perfectly!")
    print(f"   Run: npm run tauri dev")
    print(f"   Then: invoke('run_improved_bidirectional_sync')")

if __name__ == "__main__":
    main()
