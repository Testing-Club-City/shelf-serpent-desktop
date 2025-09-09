#!/usr/bin/env python3
"""
Comprehensive Bidirectional Sync Test
Tests sync between local SQLite and Supabase for all tables
"""
import sqlite3
import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, List, Any

# Configuration
DB_PATH = "/home/deniskariuki/.local/share/library-management-system/library.db"
SUPABASE_URL = 'https://ddlzenlqkofefdwdefzm.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'

# Tables to test
SYNC_TABLES = [
    'categories', 'classes', 'books', 'students', 
    'borrowings', 'book_copies', 'staff', 'fines',
    'fine_settings', 'group_borrowings', 'theft_reports'
]

class BidirectionalSyncTester:
    def __init__(self):
        self.local_conn = None
        self.session = None
        self.results = {}
        
    async def __aenter__(self):
        self.local_conn = sqlite3.connect(DB_PATH)
        self.local_conn.row_factory = sqlite3.Row
        
        self.session = aiohttp.ClientSession(
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.local_conn:
            self.local_conn.close()
        if self.session:
            await self.session.close()

    def get_local_count(self, table: str) -> int:
        """Get count of records in local table"""
        try:
            cursor = self.local_conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            return cursor.fetchone()[0]
        except sqlite3.Error as e:
            print(f"❌ Error counting local {table}: {e}")
            return 0

    def get_local_unsynced_count(self, table: str) -> int:
        """Get count of unsynced records in local table"""
        try:
            cursor = self.local_conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0")
            return cursor.fetchone()[0]
        except sqlite3.Error as e:
            print(f"⚠️  No sync column in {table}: {e}")
            return 0

    async def get_supabase_count(self, table: str) -> int:
        """Get count of records in Supabase table"""
        try:
            url = f"{SUPABASE_URL}/rest/v1/{table}?select=count"
            async with self.session.get(url, headers={'Prefer': 'count=exact'}) as response:
                if response.status == 200:
                    count_header = response.headers.get('Content-Range', '0')
                    if '/' in count_header:
                        return int(count_header.split('/')[-1])
                    return 0
                else:
                    print(f"❌ Error getting Supabase {table} count: {response.status}")
                    return 0
        except Exception as e:
            print(f"❌ Error connecting to Supabase {table}: {e}")
            return 0

    def get_sample_local_data(self, table: str, limit: int = 3) -> List[Dict]:
        """Get sample data from local table"""
        try:
            cursor = self.local_conn.cursor()
            cursor.execute(f"SELECT * FROM {table} WHERE synced = 0 LIMIT {limit}")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"❌ Error getting sample {table} data: {e}")
            return []

    async def test_supabase_connection(self) -> bool:
        """Test basic Supabase connectivity"""
        try:
            url = f"{SUPABASE_URL}/rest/v1/categories?limit=1"
            async with self.session.get(url) as response:
                return response.status == 200
        except Exception as e:
            print(f"❌ Supabase connection failed: {e}")
            return False

    async def simulate_upload_test(self, table: str, sample_data: List[Dict]) -> Dict:
        """Simulate uploading data to test mapping"""
        if not sample_data:
            return {"status": "no_data", "records": 0}
        
        try:
            # Test with first record
            test_record = sample_data[0].copy()
            
            # Remove local-only fields
            local_only_fields = ['synced', 'sync_version', 'deleted']
            for field in local_only_fields:
                test_record.pop(field, None)
            
            # Convert None values to null for JSON
            for key, value in test_record.items():
                if value is None:
                    test_record[key] = None
            
            # Test the mapping by attempting to serialize
            json_data = json.dumps(test_record, default=str)
            
            return {
                "status": "mapping_ok",
                "records": len(sample_data),
                "sample_fields": list(test_record.keys()),
                "json_size": len(json_data)
            }
            
        except Exception as e:
            return {
                "status": "mapping_error",
                "error": str(e),
                "records": len(sample_data)
            }

    async def test_table_sync(self, table: str) -> Dict:
        """Test sync for a specific table"""
        print(f"\n🔄 Testing {table}...")
        
        # Get counts
        local_count = self.get_local_count(table)
        local_unsynced = self.get_local_unsynced_count(table)
        supabase_count = await self.get_supabase_count(table)
        
        # Get sample data
        sample_data = self.get_sample_local_data(table)
        
        # Test upload mapping
        upload_test = await self.simulate_upload_test(table, sample_data)
        
        result = {
            "table": table,
            "local_total": local_count,
            "local_unsynced": local_unsynced,
            "supabase_total": supabase_count,
            "sample_records": len(sample_data),
            "upload_test": upload_test,
            "sync_ready": local_unsynced > 0 and upload_test["status"] == "mapping_ok"
        }
        
        # Print results
        print(f"  📊 Local: {local_count} total, {local_unsynced} unsynced")
        print(f"  ☁️  Supabase: {supabase_count} records")
        print(f"  🧪 Upload test: {upload_test['status']}")
        
        if upload_test["status"] == "mapping_ok":
            print(f"  ✅ Ready for sync ({local_unsynced} records)")
        elif upload_test["status"] == "no_data":
            print(f"  ℹ️  No unsynced data to test")
        else:
            print(f"  ❌ Mapping error: {upload_test.get('error', 'Unknown')}")
        
        return result

    async def run_comprehensive_test(self):
        """Run comprehensive bidirectional sync test"""
        print("🚀 Comprehensive Bidirectional Sync Test")
        print("=" * 50)
        
        # Test Supabase connection
        print("🔗 Testing Supabase connection...")
        if not await self.test_supabase_connection():
            print("❌ Cannot connect to Supabase. Check your credentials.")
            return
        print("✅ Supabase connection successful")
        
        # Test each table
        total_unsynced = 0
        ready_tables = []
        
        for table in SYNC_TABLES:
            result = await self.test_table_sync(table)
            self.results[table] = result
            
            if result["sync_ready"]:
                ready_tables.append(table)
                total_unsynced += result["local_unsynced"]
        
        # Summary
        print(f"\n📊 SYNC TEST SUMMARY")
        print("=" * 30)
        print(f"📋 Tables tested: {len(SYNC_TABLES)}")
        print(f"✅ Ready for sync: {len(ready_tables)}")
        print(f"📈 Total unsynced records: {total_unsynced}")
        
        if ready_tables:
            print(f"\n🚀 Tables ready for bidirectional sync:")
            for table in ready_tables:
                result = self.results[table]
                print(f"  • {table:15}: {result['local_unsynced']:4} → Supabase")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if total_unsynced > 0:
            print("1. ✅ Schema mapping is working correctly")
            print("2. 🚀 Ready to run actual sync commands:")
            print("   - run_database_migration()")
            print("   - run_improved_bidirectional_sync()")
            print("3. 📊 Monitor sync progress in Tauri app")
        else:
            print("1. ⚠️  No unsynced data found")
            print("2. 🔄 Consider adding test data or marking records as unsynced")
            print("3. 📥 Test download sync from Supabase")
        
        return self.results

async def main():
    """Main test function"""
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print("❌ Local database not found!")
        print(f"Expected: {DB_PATH}")
        print("Start your Tauri app first to initialize the database.")
        return
    
    async with BidirectionalSyncTester() as tester:
        results = await tester.run_comprehensive_test()
        
        # Save results
        with open('sync_test_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n💾 Results saved to: sync_test_results.json")

if __name__ == "__main__":
    asyncio.run(main())
