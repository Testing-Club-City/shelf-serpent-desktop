#!/usr/bin/env python3
"""
Create test unsynced records for testing upload functionality
"""

import sqlite3
import uuid
from datetime import datetime, timedelta

def create_test_upload_data():
    """Create test unsynced records in various tables"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🧪 Creating test unsynced records for upload testing...")
        print("=" * 60)
        
        # Create test category
        test_category_id = f"test-upload-cat-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor.execute("""
            INSERT INTO categories (id, name, description, synced, sync_version, created_at, updated_at)
            VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
        """, (test_category_id, "Test Upload Category", "Category created for upload testing"))
        print(f"✅ Created test category: {test_category_id}")
        
        # Create test theft report
        test_theft_id = f"test-upload-theft-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        cursor.execute("""
            INSERT INTO theft_reports 
            (id, expected_tracking_code, returned_tracking_code, theft_reason, 
             synced, sync_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))
        """, (test_theft_id, "EXPECTED-TEST-001", "RETURNED-WRONG-002", 
              "Test theft report for upload functionality testing"))
        print(f"✅ Created test theft report: {test_theft_id}")
        
        # Create test group borrowing
        test_group_id = f"test-upload-group-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        due_date = (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
        cursor.execute("""
            INSERT INTO group_borrowings 
            (id, tracking_code, borrowed_date, due_date, student_count, 
             synced, sync_version, created_at, updated_at, student_ids)
            VALUES (?, ?, date('now'), ?, 5, 0, 1, datetime('now'), datetime('now'), '[]')
        """, (test_group_id, f"GROUP-TEST-{datetime.now().strftime('%H%M%S')}", due_date))
        print(f"✅ Created test group borrowing: {test_group_id}")
        
        # Mark some existing records as unsynced for testing
        # Mark a few categories as unsynced
        cursor.execute("UPDATE categories SET synced = 0 WHERE id IN (SELECT id FROM categories LIMIT 2)")
        updated_categories = cursor.rowcount
        
        # Mark a few classes as unsynced  
        cursor.execute("UPDATE classes SET synced = 0 WHERE id IN (SELECT id FROM classes LIMIT 3)")
        updated_classes = cursor.rowcount
        
        conn.commit()
        
        print(f"✅ Marked {updated_categories} existing categories as unsynced")
        print(f"✅ Marked {updated_classes} existing classes as unsynced")
        
        # Show summary of unsynced records
        print("\n📊 Summary of unsynced records ready for upload:")
        print("-" * 50)
        
        tables_to_check = [
            "categories", "classes", "staff", "group_borrowings", "theft_reports"
        ]
        
        total_unsynced = 0
        for table in tables_to_check:
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0")
            unsynced_count = cursor.fetchone()[0]
            if unsynced_count > 0:
                print(f"📋 {table:<20}: {unsynced_count} unsynced records")
                total_unsynced += unsynced_count
        
        print("-" * 50)
        print(f"📊 Total unsynced records: {total_unsynced}")
        
        if total_unsynced > 0:
            print("\n🎯 Ready for upload testing!")
            print("   Go to Professional Sync Manager and click 'Upload Local Changes'")
            print("   You should see these records being uploaded to Supabase.")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        return False

def show_upload_ready_summary():
    """Show what's ready for upload testing"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n🎯 Upload Test Summary")
        print("=" * 50)
        
        # Check all tables for unsynced records
        tables = [
            "categories", "books", "book_copies", "classes", "students", 
            "staff", "borrowings", "group_borrowings", "fines", "theft_reports"
        ]
        
        total_unsynced = 0
        tables_with_data = []
        
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0 OR synced IS NULL")
            unsynced = cursor.fetchone()[0]
            
            if unsynced > 0:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                total = cursor.fetchone()[0]
                
                tables_with_data.append((table, unsynced, total))
                total_unsynced += unsynced
        
        if tables_with_data:
            print("📋 Tables with unsynced records:")
            for table, unsynced, total in tables_with_data:
                percentage = (unsynced / total * 100) if total > 0 else 0
                print(f"   {table:<20}: {unsynced:>5} / {total:>5} ({percentage:>5.1f}%)")
            
            print(f"\n📊 Total records ready for upload: {total_unsynced:,}")
            print("\n🚀 Next Steps:")
            print("   1. Open your Shelf Serpent Desktop application")
            print("   2. Go to the Professional Sync Manager")
            print("   3. Click 'Upload Local Changes' button")
            print("   4. Watch the upload progress and results")
            
        else:
            print("ℹ️  No unsynced records found.")
            print("   All data appears to be synchronized.")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🧪 Upload Functionality Test Data Creator")
    print()
    
    success = create_test_upload_data()
    
    if success:
        show_upload_ready_summary()
    else:
        print("❌ Failed to create test data")
