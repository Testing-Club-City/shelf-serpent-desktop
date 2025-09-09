#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"

def count_staff_students_legacy():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    
    try:
        print("LEGACY DATABASE ANALYSIS:")
        print("=" * 50)
        
        # Total members
        total_members = legacy_conn.execute("SELECT COUNT(*) FROM MemberDetails").fetchone()[0]
        print(f"Total members in legacy database: {total_members}")
        
        # Staff = anyone with phone number (excluding student IDs in phone column)
        staff_count = legacy_conn.execute("""
            SELECT COUNT(*)
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND NOT (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000)
        """).fetchone()[0]
        
        # Students = those without phone OR with student ID in phone column + those with RollNo
        students_with_rollno = legacy_conn.execute("""
            SELECT COUNT(*)
            FROM MemberDetails 
            WHERE RollNo IS NOT NULL 
                AND RollNo != ''
                AND (PhoneNumber IS NULL OR PhoneNumber = '' 
                     OR (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000))
        """).fetchone()[0]
        
        # Students without RollNo but also without phone
        students_no_rollno = legacy_conn.execute("""
            SELECT COUNT(*)
            FROM MemberDetails 
            WHERE (RollNo IS NULL OR RollNo = '')
                AND (PhoneNumber IS NULL OR PhoneNumber = '')
        """).fetchone()[0]
        
        total_students = students_with_rollno + students_no_rollno
        
        print(f"\nCORRECT CLASSIFICATION:")
        print(f"Staff (with phone numbers): {staff_count}")
        print(f"Students (with RollNo or no phone): {total_students}")
        print(f"  - Students with RollNo: {students_with_rollno}")
        print(f"  - Students without RollNo (no phone): {students_no_rollno}")
        print(f"Total: {staff_count + total_students}")
        
        # Verify the 3 students with IDs in phone column
        students_in_phone = legacy_conn.execute("""
            SELECT PhoneNumber, Name, RollNo
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND PhoneNumber GLOB '[0-9]*' 
                AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000
        """).fetchall()
        
        print(f"\nStudents with IDs in phone column: {len(students_in_phone)}")
        for phone, name, roll_no in students_in_phone:
            print(f"  {phone} - {name} (RollNo: {roll_no})")
        
        # Check for any overlaps or issues
        print(f"\nVERIFICATION:")
        
        # Members with both phone and RollNo (should be staff with TSC numbers)
        both_phone_rollno = legacy_conn.execute("""
            SELECT COUNT(*)
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND RollNo IS NOT NULL 
                AND RollNo != ''
                AND NOT (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000)
        """).fetchone()[0]
        
        print(f"Staff with both phone AND RollNo (TSC numbers): {both_phone_rollno}")
        
        # Show some examples
        examples = legacy_conn.execute("""
            SELECT PhoneNumber, Name, RollNo
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND RollNo IS NOT NULL 
                AND RollNo != ''
                AND NOT (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000)
            LIMIT 5
        """).fetchall()
        
        print(f"Examples of staff with TSC numbers:")
        for phone, name, roll_no in examples:
            print(f"  {phone} - {name} (TSC: {roll_no})")
        
        # Check members with neither phone nor RollNo
        neither = legacy_conn.execute("""
            SELECT COUNT(*)
            FROM MemberDetails 
            WHERE (PhoneNumber IS NULL OR PhoneNumber = '')
                AND (RollNo IS NULL OR RollNo = '')
        """).fetchone()[0]
        
        print(f"\nMembers with neither phone nor RollNo: {neither}")
        
        if neither > 0:
            examples_neither = legacy_conn.execute("""
                SELECT Name, MemberID
                FROM MemberDetails 
                WHERE (PhoneNumber IS NULL OR PhoneNumber = '')
                    AND (RollNo IS NULL OR RollNo = '')
                LIMIT 5
            """).fetchall()
            
            print("Examples:")
            for name, member_id in examples_neither:
                print(f"  {name} (ID: {member_id})")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()

if __name__ == "__main__":
    count_staff_students_legacy()
