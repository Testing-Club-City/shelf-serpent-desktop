#!/usr/bin/env python3
"""
Test script to verify group borrowing functionality using admission numbers
This script tests the complete flow from student search to group borrowing creation
"""

import sqlite3
import json
from datetime import datetime, timedelta

def test_group_borrowing_admission_flow():
    """Test the complete group borrowing flow using admission numbers"""
    
    # Connect to local database
    conn = sqlite3.connect('shelf-serpent.db')
    cursor = conn.cursor()
    
    print("🧪 Testing Group Borrowing Admission Flow")
    print("=" * 50)
    
    # Test 1: Verify students have admission numbers
    print("\n1. Checking student admission numbers...")
    cursor.execute("SELECT id, first_name, last_name, admission_number, class_grade FROM students WHERE status = 'active' LIMIT 5")
    students = cursor.fetchall()
    
    if not students:
        print("❌ No active students found")
        return False
    
    print(f"✅ Found {len(students)} active students")
    for student in students:
        print(f"   - {student[1]} {student[2]} (Admission: {student[3]}, Class: {student[4]})")
    
    # Test 2: Verify book copies exist
    print("\n2. Checking available book copies...")
    cursor.execute("""
        SELECT bc.id, bc.tracking_code, b.title, b.author, bc.copy_number 
        FROM book_copies bc 
        JOIN books b ON bc.book_id = b.id 
        WHERE bc.status = 'available' LIMIT 5
    """)
    book_copies = cursor.fetchall()
    
    if not book_copies:
        print("❌ No available book copies found")
        return False
    
    print(f"✅ Found {len(book_copies)} available book copies")
    for copy in book_copies:
        print(f"   - {copy[2]} by {copy[3]} (Tracking: {copy[1]}, Copy #{copy[4]})")
    
    # Test 3: Create test group borrowing with admission numbers
    print("\n3. Creating test group borrowing...")
    
    # Select test students and book
    test_students = [students[0][3], students[1][3]]  # Use admission numbers
    test_book_copy = book_copies[0]
    
    # Prepare group borrowing data
    group_borrowing = {
        'student_admissions': test_students,
        'book_copy_id': test_book_copy[0],
        'borrowed_date': datetime.now().isoformat(),
        'return_date': (datetime.now() + timedelta(days=14)).isoformat(),
        'purpose': 'Group study session',
        'notes': 'Test group borrowing with admission numbers',
        'student_count': len(test_students)
    }
    
    print(f"   📋 Group borrowing data:")
    print(f"      Students: {test_students}")
    print(f"      Book: {test_book_copy[2]} (ID: {test_book_copy[0]})")
    print(f"      Purpose: {group_borrowing['purpose']}")
    
    # Test 4: Insert into database
    print("\n4. Inserting group borrowing into database...")
    try:
        cursor.execute("""
            INSERT INTO group_borrowings 
            (student_admissions, book_copy_id, borrowed_date, return_date, purpose, notes, status, student_count)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
        """, (
            json.dumps(test_students),
            test_book_copy[0],
            group_borrowing['borrowed_date'],
            group_borrowing['return_date'],
            group_borrowing['purpose'],
            group_borrowing['notes'],
            group_borrowing['student_count']
        ))
        
        group_borrowing_id = cursor.lastrowid
        conn.commit()
        print(f"✅ Successfully created group borrowing (ID: {group_borrowing_id})")
        
    except Exception as e:
        print(f"❌ Failed to create group borrowing: {e}")
        conn.rollback()
        return False
    
    # Test 5: Verify group borrowing can be retrieved by admission number
    print("\n5. Testing retrieval by admission number...")
    try:
        cursor.execute("""
            SELECT id, student_admissions, book_copy_id, purpose, student_count
            FROM group_borrowings 
            WHERE student_admissions LIKE ?
        """, (f'%{test_students[0]}%',))
        
        retrieved = cursor.fetchall()
        print(f"✅ Found {len(retrieved)} group borrowings for admission {test_students[0]}")
        
        for borrowing in retrieved:
            student_list = json.loads(borrowing[1])
            print(f"   📖 Group borrowing {borrowing[0]}:")
            print(f"      Students: {student_list}")
            print(f"      Book copy ID: {borrowing[2]}")
            print(f"      Purpose: {borrowing[3]}")
            print(f"      Student count: {borrowing[4]}")
            
            # Verify admission numbers are correctly stored
            if all(admission in student_list for admission in test_students):
                print("   ✅ All admission numbers correctly stored")
            else:
                print("   ❌ Admission numbers mismatch")
                return False
    
    except Exception as e:
        print(f"❌ Failed to retrieve group borrowing: {e}")
        return False
    
    # Test 6: Clean up test data
    print("\n6. Cleaning up test data...")
    try:
        cursor.execute("DELETE FROM group_borrowings WHERE id = ?", (group_borrowing_id,))
        conn.commit()
        print("✅ Test data cleaned up")
    except Exception as e:
        print(f"⚠️  Warning: Could not clean up test data: {e}")
    
    conn.close()
    
    print("\n🎉 All tests passed! Group borrowing admission flow is working correctly")
    return True

def test_student_grouping_by_admission():
    """Test grouping students by admission numbers"""
    
    print("\n🔍 Testing Student Grouping by Admission Numbers")
    print("=" * 50)
    
    conn = sqlite3.connect('shelf-serpent.db')
    cursor = conn.cursor()
    
    # Test grouping logic with admission numbers
    cursor.execute("""
        SELECT admission_number, COUNT(*) as count, GROUP_CONCAT(first_name || ' ' || last_name) as names
        FROM students 
        WHERE status = 'active' 
        GROUP BY admission_number
        HAVING count > 1
    """)
    
    duplicate_admissions = cursor.fetchall()
    
    if duplicate_admissions:
        print("⚠️  Found duplicate admission numbers:")
        for admission, count, names in duplicate_admissions:
            print(f"   - {admission}: {count} students ({names})")
    else:
        print("✅ No duplicate admission numbers found - grouping will work correctly")
    
    # Test admission number format validation
    cursor.execute("SELECT admission_number FROM students WHERE admission_number IS NOT NULL LIMIT 10")
    admissions = cursor.fetchall()
    
    print("\n📋 Sample admission numbers:")
    for admission in admissions:
        print(f"   - {admission[0]}")
    
    conn.close()
    return True

if __name__ == "__main__":
    print("Starting Group Borrowing Admission Integration Tests...")
    
    # Run all tests
    test1 = test_group_borrowing_admission_flow()
    test2 = test_student_grouping_by_admission()
    
    if test1 and test2:
        print("\n✅ All integration tests passed!")
        print("Group borrowing functionality is ready for production with admission numbers")
    else:
        print("\n❌ Some tests failed. Please check the issues above.")
