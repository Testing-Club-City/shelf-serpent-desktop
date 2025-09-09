#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def compare_legacy_new_matching():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        print("COMPARING LEGACY vs NEW SYSTEM RECORDS:")
        print("=" * 60)
        
        # Get all RollNo from legacy database (students)
        legacy_students = set()
        legacy_student_cursor = legacy_conn.execute("""
            SELECT DISTINCT RollNo 
            FROM MemberDetails 
            WHERE RollNo IS NOT NULL AND RollNo != ''
                AND (PhoneNumber IS NULL OR PhoneNumber = '' 
                     OR (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000))
        """)
        for (roll_no,) in legacy_student_cursor:
            legacy_students.add(roll_no)
        
        # Get all admission_number from new system
        new_students = set()
        new_student_cursor = local_conn.execute("SELECT DISTINCT admission_number FROM students WHERE admission_number IS NOT NULL")
        for (admission_number,) in new_student_cursor:
            new_students.add(admission_number)
        
        print(f"STUDENT MATCHING:")
        print(f"Legacy students (RollNo): {len(legacy_students)}")
        print(f"New system students (admission_number): {len(new_students)}")
        
        # Check matching
        matching_students = legacy_students.intersection(new_students)
        legacy_only = legacy_students - new_students
        new_only = new_students - legacy_students
        
        print(f"Perfect matches: {len(matching_students)}")
        print(f"In legacy only: {len(legacy_only)}")
        print(f"In new system only: {len(new_only)}")
        
        if legacy_only:
            print(f"\nSample legacy students NOT in new system:")
            sample_legacy_only = list(legacy_only)[:10]
            for roll_no in sample_legacy_only:
                # Get name from legacy
                name_result = legacy_conn.execute("SELECT Name FROM MemberDetails WHERE RollNo = ? LIMIT 1", (roll_no,)).fetchone()
                name = name_result[0] if name_result else "Unknown"
                print(f"  {roll_no} - {name}")
        
        if new_only:
            print(f"\nSample new system students NOT in legacy:")
            sample_new_only = list(new_only)[:10]
            for admission_number in sample_new_only:
                # Get name from new system
                name_result = local_conn.execute("SELECT first_name, last_name FROM students WHERE admission_number = ? LIMIT 1", (admission_number,)).fetchone()
                name = f"{name_result[0]} {name_result[1]}" if name_result else "Unknown"
                print(f"  {admission_number} - {name}")
        
        # Now check staff matching
        print(f"\n" + "=" * 60)
        print(f"STAFF MATCHING:")
        
        # Get all phone numbers from legacy (staff)
        legacy_staff = set()
        legacy_staff_cursor = legacy_conn.execute("""
            SELECT DISTINCT PhoneNumber 
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL AND PhoneNumber != ''
                AND NOT (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000)
        """)
        for (phone,) in legacy_staff_cursor:
            # Clean phone number (remove spaces)
            clean_phone = phone.strip()
            legacy_staff.add(clean_phone)
        
        # Get all phone numbers from new system
        new_staff = set()
        new_staff_cursor = local_conn.execute("SELECT DISTINCT phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for (phone,) in new_staff_cursor:
            new_staff.add(phone)
        
        print(f"Legacy staff (PhoneNumber): {len(legacy_staff)}")
        print(f"New system staff (phone): {len(new_staff)}")
        
        # Check matching
        matching_staff = legacy_staff.intersection(new_staff)
        legacy_staff_only = legacy_staff - new_staff
        new_staff_only = new_staff - legacy_staff
        
        print(f"Perfect matches: {len(matching_staff)}")
        print(f"In legacy only: {len(legacy_staff_only)}")
        print(f"In new system only: {len(new_staff_only)}")
        
        if legacy_staff_only:
            print(f"\nSample legacy staff NOT in new system:")
            sample_legacy_staff_only = list(legacy_staff_only)[:10]
            for phone in sample_legacy_staff_only:
                # Get name from legacy
                name_result = legacy_conn.execute("SELECT Name FROM MemberDetails WHERE TRIM(PhoneNumber) = ? LIMIT 1", (phone,)).fetchone()
                name = name_result[0] if name_result else "Unknown"
                print(f"  {phone} - {name}")
        
        if new_staff_only:
            print(f"\nSample new system staff NOT in legacy:")
            sample_new_staff_only = list(new_staff_only)[:10]
            for phone in sample_new_staff_only:
                # Get name from new system
                name_result = local_conn.execute("SELECT first_name, last_name FROM staff WHERE phone = ? LIMIT 1", (phone,)).fetchone()
                name = f"{name_result[0]} {name_result[1]}" if name_result else "Unknown"
                print(f"  {phone} - {name}")
        
        # Summary
        print(f"\n" + "=" * 60)
        print(f"MIGRATION COVERAGE SUMMARY:")
        student_coverage = (len(matching_students) / len(legacy_students) * 100) if legacy_students else 0
        staff_coverage = (len(matching_staff) / len(legacy_staff) * 100) if legacy_staff else 0
        
        print(f"Student migration coverage: {student_coverage:.1f}% ({len(matching_students)}/{len(legacy_students)})")
        print(f"Staff migration coverage: {staff_coverage:.1f}% ({len(matching_staff)}/{len(legacy_staff)})")
        
        # Check borrowings impact
        if legacy_staff_only:
            missing_staff_phones = list(legacy_staff_only)
            placeholders = ','.join(['?' for _ in missing_staff_phones])
            
            missing_borrowings = legacy_conn.execute(f"""
                SELECT COUNT(*)
                FROM IssueDetails i
                JOIN MemberDetails m ON i.MemberID = m.MemberID
                WHERE TRIM(m.PhoneNumber) IN ({placeholders})
                
                UNION ALL
                
                SELECT COUNT(*)
                FROM SubmittedBooks s
                JOIN MemberDetails m ON s.MemberID = m.MemberID
                WHERE TRIM(m.PhoneNumber) IN ({placeholders})
            """, missing_staff_phones + missing_staff_phones).fetchall()
            
            active_missing = missing_borrowings[0][0] if missing_borrowings else 0
            returned_missing = missing_borrowings[1][0] if len(missing_borrowings) > 1 else 0
            
            print(f"\nBorrowings from missing staff:")
            print(f"  Active: {active_missing}")
            print(f"  Returned: {returned_missing}")
            print(f"  Total: {active_missing + returned_missing}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    compare_legacy_new_matching()
