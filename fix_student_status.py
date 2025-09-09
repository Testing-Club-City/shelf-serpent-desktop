#!/usr/bin/env python3
"""
Fix student status issue in Shelf Serpent Desktop database
Changes 'graduated' status to 'inactive' to match UI expectations
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime

def fix_student_status():
    """Fix student status from 'graduated' to 'inactive'"""
    
    db_path = Path.home() / "AppData/Roaming/library-management-system/library.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"🔧 FIXING STUDENT STATUS ISSUE")
    print(f"Database: {db_path}")
    print("=" * 80)
    
    try:
        # Create backup first
        backup_path = db_path.parent / f"library_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        print(f"📋 Creating backup at: {backup_path}")
        
        import shutil
        shutil.copy2(str(db_path), str(backup_path))
        print("✅ Backup created successfully")
        
        # Connect to database
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check current status before fix
        cursor.execute("""
            SELECT 
                status,
                COUNT(*) as count
            FROM students 
            GROUP BY status
            ORDER BY count DESC
        """)
        
        print("\n📊 Current Status Distribution:")
        status_before = cursor.fetchall()
        for row in status_before:
            status = row['status'] or 'NULL'
            count = row['count']
            print(f"   {status}: {count} students")
        
        # Count students with 'graduated' status
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE status = 'graduated'")
        graduated_count = cursor.fetchone()['count']
        
        if graduated_count == 0:
            print("\n✅ No students with 'graduated' status found. Nothing to fix!")
            conn.close()
            return
        
        print(f"\n🔧 Found {graduated_count} students with 'graduated' status")
        print("   Changing their status to 'inactive'...")
        
        # Apply the fix
        cursor.execute("""
            UPDATE students 
            SET status = 'inactive', 
                updated_at = datetime('now') 
            WHERE status = 'graduated'
        """)
        
        affected_rows = cursor.rowcount
        conn.commit()
        
        print(f"✅ Successfully updated {affected_rows} student records")
        
        # Verify the fix
        cursor.execute("""
            SELECT 
                status,
                COUNT(*) as count
            FROM students 
            GROUP BY status
            ORDER BY count DESC
        """)
        
        print("\n📊 Status Distribution After Fix:")
        status_after = cursor.fetchall()
        for row in status_after:
            status = row['status'] or 'NULL'
            count = row['count']
            print(f"   {status}: {count} students")
        
        # Verify no 'graduated' status remains
        cursor.execute("SELECT COUNT(*) as count FROM students WHERE status = 'graduated'")
        remaining_graduated = cursor.fetchone()['count']
        
        if remaining_graduated == 0:
            print("\n✅ SUCCESS: All 'graduated' status records have been fixed!")
            print("   Students now have proper 'inactive' status as expected by the UI")
        else:
            print(f"\n⚠️  Warning: {remaining_graduated} students still have 'graduated' status")
        
        conn.close()
        
        print("\n🎉 FIX COMPLETED!")
        print("=" * 50)
        print("✅ Database has been updated successfully")
        print("✅ Backup created for safety")
        print("✅ Students with 'graduated' status are now 'inactive'")
        print("\n📝 Next Steps:")
        print("1. Restart the Shelf Serpent Desktop application")
        print("2. Go to Student Management")
        print("3. Students should now show as 'Inactive' instead of 'Graduated'")
        print("4. The 'Class Graduated' badge will show for students in graduated classes")
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    # Ask for confirmation before making changes
    print("🚨 WARNING: This script will modify your database!")
    print("A backup will be created automatically.")
    
    response = input("\nDo you want to proceed with fixing the student status? (y/N): ")
    
    if response.lower() in ['y', 'yes']:
        fix_student_status()
    else:
        print("❌ Operation cancelled by user")
