#!/usr/bin/env python3
"""
Create simple test records for upload testing (no foreign key dependencies)
"""

import sqlite3
import uuid
from datetime import datetime

def create_simple_test_records():
    """Create simple test records that don't have foreign key dependencies"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🧪 Creating simple test records for upload...")
        print("=" * 50)
        
        # Clear any existing test records first
        cursor.execute("DELETE FROM categories WHERE name LIKE 'Test Upload%'")
        cursor.execute("DELETE FROM classes WHERE class_name LIKE 'Test Upload%'")
        cursor.execute("DELETE FROM staff WHERE first_name LIKE 'Test Upload%'")
        
        # Create test category with proper UUID
        test_category_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO categories (id, name, description, synced, sync_version, created_at, updated_at)
            VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
        """, (test_category_id, "Test Upload Category Simple", "Simple category for upload testing"))
        print(f"✅ Created test category: {test_category_id}")
        
        # Create test class with proper UUID
        test_class_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO classes (id, class_name, form_level, synced, sync_version, created_at, updated_at)
            VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
        """, (test_class_id, "Test Upload Class 1A", 1))
        print(f"✅ Created test class: {test_class_id}")
        
        # Create test staff with proper UUID
        test_staff_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO staff (id, staff_id, first_name, last_name, synced, sync_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))
        """, (test_staff_id, "STAFF-TEST-001", "Test Upload", "Staff Member"))
        print(f"✅ Created test staff: {test_staff_id}")
        
        conn.commit()
        
        # Show summary
        print("\n📊 Simple upload test summary:")
        print("-" * 40)
        
        simple_tables = ["categories", "classes", "staff"]
        total_unsynced = 0
        
        for table in simple_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE synced = 0")
            unsynced = cursor.fetchone()[0]
            if unsynced > 0:
                print(f"📋 {table:<15}: {unsynced} unsynced records")
                total_unsynced += unsynced
        
        print("-" * 40)
        print(f"📊 Total simple records: {total_unsynced}")
        
        if total_unsynced > 0:
            print("\n🎯 Ready for simple upload test!")
            print("   These records have no foreign key dependencies")
            print("   They should upload successfully to Supabase")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def verify_uuid_format():
    """Verify that our test records have proper UUID format"""
    
    db_path = "/home/deniskariuki/.local/share/library-management-system/library.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n🔍 Verifying UUID formats...")
        
        # Check categories
        cursor.execute("SELECT id, name FROM categories WHERE synced = 0")
        for row in cursor.fetchall():
            record_id, name = row
            try:
                uuid.UUID(record_id)
                print(f"✅ Category '{name}': Valid UUID {record_id}")
            except ValueError:
                print(f"❌ Category '{name}': Invalid UUID {record_id}")
        
        # Check classes  
        cursor.execute("SELECT id, class_name FROM classes WHERE synced = 0")
        for row in cursor.fetchall():
            record_id, class_name = row
            try:
                uuid.UUID(record_id)
                print(f"✅ Class '{class_name}': Valid UUID {record_id}")
            except ValueError:
                print(f"❌ Class '{class_name}': Invalid UUID {record_id}")
        
        # Check staff
        cursor.execute("SELECT id, first_name, last_name FROM staff WHERE synced = 0")
        for row in cursor.fetchall():
            record_id, first_name, last_name = row
            try:
                uuid.UUID(record_id)
                print(f"✅ Staff '{first_name} {last_name}': Valid UUID {record_id}")
            except ValueError:
                print(f"❌ Staff '{first_name} {last_name}': Invalid UUID {record_id}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error verifying UUIDs: {e}")

if __name__ == "__main__":
    print("🧪 Simple Upload Test Data Creator")
    print()
    
    success = create_simple_test_records()
    
    if success:
        verify_uuid_format()
        print("\n🚀 Next Steps:")
        print("   1. Open your Shelf Serpent Desktop application")
        print("   2. Go to Professional Sync Manager")
        print("   3. Click 'Upload Local Changes'")
        print("   4. Should see 3 simple records uploaded successfully")
    else:
        print("❌ Failed to create simple test data")
