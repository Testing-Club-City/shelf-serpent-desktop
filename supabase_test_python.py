#!/usr/bin/env python3

import requests
import json

class SupabaseTest:
    def __init__(self):
        self.supabase_url = "https://ddlzenlqkofefdwdefzm.supabase.co"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }

    def test_supabase_connection(self):
        """Test basic connection with a simple query"""
        try:
            print("Testing Supabase connection...")
            
            # Test basic connection with books table count
            headers_with_count = self.headers.copy()
            headers_with_count["Prefer"] = "count=exact"
            
            response = requests.get(
                f"{self.supabase_url}/rest/v1/books",
                headers=headers_with_count,
                params={"select": "count"}
            )
            
            if response.status_code == 200:
                print("Supabase connection successful")
                print(f"Supabase URL: {self.supabase_url}")
                return True
            else:
                print(f"❌ Supabase connection error: {response.status_code}")
                print(f"🔧 Error details: {response.text}")
                return False
                
        except Exception as err:
            print(f"❌ Supabase connection failed: {err}")
            return False

    def list_supabase_tables(self):
        """Check known tables"""
        try:
            known_tables = ['books', 'students', 'borrowings', 'categories', 'staff', 'fines', 'classes']
            print("📋 Checking known tables:")
            
            for table in known_tables:
                try:
                    response = requests.get(
                        f"{self.supabase_url}/rest/v1/{table}",
                        headers=self.headers,
                        params={"limit": "1"}
                    )
                    status = "✅" if response.status_code == 200 else "❌"
                    print(f"{status} {table}")
                except:
                    print(f"❌ {table}")
                    
        except Exception as err:
            print(f"❌ Error listing tables: {err}")

    def check_classes_table(self):
        """Check classes table specifically"""
        try:
            print("🔍 Checking classes table specifically...")
            
            # Get all classes data with count
            headers_with_count = self.headers.copy()
            headers_with_count["Prefer"] = "count=exact"
            
            response = requests.get(
                f"{self.supabase_url}/rest/v1/classes",
                headers=headers_with_count,
                params={"select": "*", "order": "id.asc"}
            )
            
            if response.status_code != 200:
                print(f"❌ Classes table error: {response.status_code}")
                print(f"Error details: {response.text}")
                return None
            
            data = response.json()
            content_range = response.headers.get('content-range', '')
            
            # Extract count from content-range header
            total_count = 0
            if '/' in content_range:
                total_count = int(content_range.split('/')[-1])
            
            print(f"✅ Classes table found with {total_count} total records")
            
            if data and len(data) > 0:
                # Get column names from first record
                columns = list(data[0].keys())
                print(f"📋 Classes table columns: {', '.join(columns)}")
                
                print("\n📊 CLASSES DATA:")
                print("=" * 60)
                
                for index, class_item in enumerate(data):
                    print(f"\n🏫 Class {index + 1}:")
                    for key, value in class_item.items():
                        display_value = json.dumps(value, indent=2) if isinstance(value, (dict, list)) else str(value)
                        print(f"   {key}: {display_value}")
                
                print("\n" + "=" * 60)
                print(f"📈 Total classes displayed: {len(data)}")
            else:
                print("⚠️ No class data found")
            
            return data
            
        except Exception as err:
            print(f"❌ Error checking classes table: {err}")
            return None

    def run_supabase_tests(self):
        """Run all tests"""
        print("Testing Supabase connection...")
        
        is_connected = self.test_supabase_connection()
        if is_connected:
            self.list_supabase_tables()
            print("\n" + "=" * 50)
            self.check_classes_table()

if __name__ == "__main__":
    tester = SupabaseTest()
    tester.run_supabase_tests()