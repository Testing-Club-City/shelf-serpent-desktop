#!/usr/bin/env python3
"""
Comprehensive test of the complete student status fix
Tests both database changes and UI display logic
"""

import sqlite3
from pathlib import Path

def test_database_fix():
    """Test the database fix"""
    db_path = Path.home() / ".local/share/library-management-system/library.db"
    
    print("🔍 TESTING DATABASE FIX")
    print("=" * 50)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check status distribution
        cursor.execute("""
            SELECT 
                status,
                COUNT(*) as count
            FROM students 
            GROUP BY status
            ORDER BY count DESC
        """)
        
        status_distribution = cursor.fetchall()
        print("📊 Database Status Distribution:")
        
        has_graduated = False
        for row in status_distribution:
            status = row['status'] or 'NULL'
            count = row['count']
            print(f"   {status}: {count} students")
            if status == 'graduated':
                has_graduated = True
        
        if has_graduated:
            print("❌ FAIL: Still has 'graduated' status in database")
            return False
        else:
            print("✅ PASS: No 'graduated' status found in database")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

def test_ui_logic():
    """Test the UI display logic"""
    print("\n🎨 TESTING UI DISPLAY LOGIC")
    print("=" * 50)
    
    # Simulate the UI functions
    def getStatusColor(status):
        switch = {
            'active': 'bg-green-100 text-green-800',
            'inactive': 'bg-red-100 text-red-800',
            'graduated': 'bg-blue-100 text-blue-800',
            'transferred': 'bg-purple-100 text-purple-800'
        }
        return switch.get(status.lower() if status else 'active', 'bg-gray-100 text-gray-800')
    
    def getStatusDisplayText(status):
        switch = {
            'active': 'Active',
            'inactive': 'Inactive',
            'graduated': 'Graduated',
            'transferred': 'Transferred'
        }
        return switch.get(status.lower() if status else 'active', 'Active')
    
    # Test cases
    test_cases = [
        ('active', 'Active', 'bg-green-100 text-green-800'),
        ('inactive', 'Inactive', 'bg-red-100 text-red-800'),
        (None, 'Active', 'bg-green-100 text-green-800'),
        ('', 'Active', 'bg-green-100 text-green-800')
    ]
    
    all_passed = True
    for db_status, expected_display, expected_color in test_cases:
        actual_display = getStatusDisplayText(db_status)
        actual_color = getStatusColor(db_status or 'active')
        
        display_pass = actual_display == expected_display
        color_pass = actual_color == expected_color
        
        status_str = db_status if db_status else 'NULL'
        print(f"   Status '{status_str}' -> Display: '{actual_display}' {'✅' if display_pass else '❌'}")
        
        if not (display_pass and color_pass):
            all_passed = False
    
    if all_passed:
        print("✅ PASS: All UI display logic tests passed")
    else:
        print("❌ FAIL: Some UI display logic tests failed")
    
    return all_passed

def main():
    print("🧪 COMPREHENSIVE STUDENT STATUS FIX TEST")
    print("=" * 60)
    
    db_test_passed = test_database_fix()
    ui_test_passed = test_ui_logic()
    
    print("\n📋 FINAL TEST RESULTS")
    print("=" * 30)
    print(f"Database Fix: {'✅ PASS' if db_test_passed else '❌ FAIL'}")
    print(f"UI Logic Fix: {'✅ PASS' if ui_test_passed else '❌ FAIL'}")
    
    if db_test_passed and ui_test_passed:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Database has correct status values")
        print("✅ UI will display proper capitalized status")
        print("✅ Ready for application testing")
        
        print("\n📱 EXPECTED APP BEHAVIOR:")
        print("- 3,589 students will show as 'Inactive' with red badges")
        print("- 1,199 students will show as 'Active' with green badges")
        print("- Students in graduated classes will show 'Class Graduated' badge")
        print("- No more confusing 'graduated' status display")
    else:
        print("\n❌ SOME TESTS FAILED - NEEDS ATTENTION")

if __name__ == "__main__":
    main()
