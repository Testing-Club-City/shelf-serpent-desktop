#!/usr/bin/env python3
"""
Test pulling data from Supabase to diagnose sync issues
"""

import asyncio
import httpx
import sqlite3
import os
from pathlib import Path

class SupabasePullTest:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
        
        # Create fresh database path
        self.db_dir = Path.home() / ".local/share/library-management-system"
        self.db_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.db_dir / "library.db"

    async def test_supabase_connectivity(self):
        """Test basic connectivity to Supabase"""
        print("🔍 Testing Supabase connectivity...")
        
        async with httpx.AsyncClient() as client:
            try:
                # Test basic connection
                response = await client.get(f"{self.base_url}/borrowings?limit=1", headers=self.headers)
                if response.status_code == 200:
                    print("✅ Supabase connection successful")
                    return True
                else:
                    print(f"❌ Supabase connection failed: {response.status_code}")
                    return False
            except Exception as e:
                print(f"❌ Connection error: {e}")
                return False

    async def get_table_counts(self):
        """Get record counts from all tables"""
        print("\n📊 Getting table counts from Supabase...")
        
        tables = ["books", "book_copies", "students", "staff", "borrowings", "categories", "fines"]
        counts = {}
        
        async with httpx.AsyncClient() as client:
            for table in tables:
                try:
                    response = await client.get(
                        f"{self.base_url}/{table}?select=count",
                        headers={**self.headers, "Prefer": "count=exact"}
                    )
                    if response.status_code == 200:
                        count = int(response.headers.get("content-range", "0").split("/")[-1])
                        counts[table] = count
                        print(f"  📋 {table}: {count:,} records")
                    else:
                        counts[table] = 0
                        print(f"  ❌ {table}: Failed to get count")
                except Exception as e:
                    counts[table] = 0
                    print(f"  ❌ {table}: Error - {e}")
        
        return counts

    async def test_borrowing_relationships(self):
        """Test borrowing relationships and legacy book ID access"""
        print("\n🔗 Testing borrowing relationships...")
        
        async with httpx.AsyncClient() as client:
            try:
                # Test borrowing with book_copy join
                response = await client.get(
                    f"{self.base_url}/borrowings?select=id,borrower_type,book_copy_id,book_copies(id,legacy_book_id)&limit=3",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    borrowings = response.json()
                    print("✅ Borrowing-BookCopy join successful")
                    
                    for borrowing in borrowings:
                        book_copy = borrowing.get("book_copies")
                        legacy_id = book_copy.get("legacy_book_id") if book_copy else None
                        print(f"  📖 Borrowing {borrowing['id'][:8]}... -> Legacy ID: {legacy_id}")
                    
                    return True
                else:
                    print(f"❌ Borrowing join failed: {response.status_code}")
                    return False
                    
            except Exception as e:
                print(f"❌ Relationship test error: {e}")
                return False

    def create_minimal_schema(self):
        """Create minimal database schema for testing"""
        print("\n🏗️ Creating minimal database schema...")
        
        conn = sqlite3.connect(self.db_path)
        
        # Create basic tables
        conn.execute("""
            CREATE TABLE IF NOT EXISTS borrowings (
                id TEXT PRIMARY KEY,
                student_id TEXT,
                staff_id TEXT,
                book_id TEXT,
                book_copy_id TEXT,
                borrower_type TEXT DEFAULT 'student',
                borrowed_date TEXT,
                due_date TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS book_copies (
                id TEXT PRIMARY KEY,
                legacy_book_id INTEGER,
                title TEXT,
                author TEXT,
                isbn TEXT,
                status TEXT DEFAULT 'available',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        conn.commit()
        conn.close()
        print("✅ Minimal schema created")

    async def pull_sample_data(self):
        """Pull sample data from Supabase"""
        print("\n📥 Pulling sample data from Supabase...")
        
        conn = sqlite3.connect(self.db_path)
        
        async with httpx.AsyncClient() as client:
            # Pull sample borrowings
            response = await client.get(f"{self.base_url}/borrowings?limit=10", headers=self.headers)
            if response.status_code == 200:
                borrowings = response.json()
                
                for borrowing in borrowings:
                    conn.execute("""
                        INSERT OR REPLACE INTO borrowings 
                        (id, student_id, staff_id, book_id, book_copy_id, borrower_type, borrowed_date, due_date, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        borrowing.get("id"),
                        borrowing.get("student_id"),
                        borrowing.get("staff_id"),
                        borrowing.get("book_id"),
                        borrowing.get("book_copy_id"),
                        borrowing.get("borrower_type", "student"),
                        borrowing.get("borrowed_date"),
                        borrowing.get("due_date"),
                        borrowing.get("status", "active")
                    ))
                
                conn.commit()
                print(f"✅ Pulled {len(borrowings)} borrowings")
            
            # Pull sample book_copies
            response = await client.get(f"{self.base_url}/book_copies?limit=10", headers=self.headers)
            if response.status_code == 200:
                book_copies = response.json()
                
                for copy in book_copies:
                    conn.execute("""
                        INSERT OR REPLACE INTO book_copies 
                        (id, legacy_book_id, title, author, isbn, status)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        copy.get("id"),
                        copy.get("legacy_book_id"),
                        copy.get("title"),
                        copy.get("author"),
                        copy.get("isbn"),
                        copy.get("status", "available")
                    ))
                
                conn.commit()
                print(f"✅ Pulled {len(book_copies)} book copies")
        
        conn.close()

    async def test_local_relationships(self):
        """Test local database relationships"""
        print("\n🔍 Testing local database relationships...")
        
        conn = sqlite3.connect(self.db_path)
        
        # Test borrowing -> book_copy -> legacy_book_id join
        cursor = conn.execute("""
            SELECT 
                b.id,
                b.borrower_type,
                b.book_copy_id,
                bc.legacy_book_id
            FROM borrowings b
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE bc.legacy_book_id IS NOT NULL
            LIMIT 5
        """)
        
        results = cursor.fetchall()
        if results:
            print("✅ Local relationships working:")
            for row in results:
                print(f"  📖 Borrowing {row[0][:8]}... ({row[1]}) -> Legacy ID: {row[3]}")
        else:
            print("❌ No local relationships found")
        
        conn.close()

    async def run_full_test(self):
        """Run complete diagnostic test"""
        print("🚀 Starting Supabase Pull Diagnostic Test")
        print("=" * 50)
        
        # Test connectivity
        if not await self.test_supabase_connectivity():
            return
        
        # Get table counts
        counts = await self.get_table_counts()
        
        # Test relationships
        await self.test_borrowing_relationships()
        
        # Create local schema
        self.create_minimal_schema()
        
        # Pull sample data
        await self.pull_sample_data()
        
        # Test local relationships
        await self.test_local_relationships()
        
        print("\n" + "=" * 50)
        print("🎯 DIAGNOSTIC COMPLETE")
        print(f"📁 Test database created at: {self.db_path}")
        print("💡 Check if Windows can now access legacy book IDs properly")

async def main():
    tester = SupabasePullTest()
    await tester.run_full_test()

if __name__ == "__main__":
    asyncio.run(main())
