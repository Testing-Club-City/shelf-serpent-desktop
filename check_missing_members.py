#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def check_missing_members():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        # Get existing mappings from local database
        existing_staff_phones = set()
        staff_cursor = local_conn.execute("SELECT phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for (phone,) in staff_cursor:
            existing_staff_phones.add(phone)
        
        existing_student_admissions = set()
        student_cursor = local_conn.execute("SELECT admission_number FROM students WHERE admission_number IS NOT NULL")
        for (admission_number,) in student_cursor:
            existing_student_admissions.add(admission_number)
        
        print(f"Existing in new database:")
        print(f"- Staff phones: {len(existing_staff_phones)}")
        print(f"- Student admission numbers: {len(existing_student_admissions)}")
        print()
        
        # Check staff members in legacy database
        print("STAFF ANALYSIS:")
        print("=" * 50)
        
        staff_in_legacy = legacy_conn.execute("""
            SELECT DISTINCT m.PhoneNumber, m.Name, COUNT(*) as borrowing_count
            FROM MemberDetails m 
            JOIN IssueDetails i ON m.MemberID = i.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
            GROUP BY m.PhoneNumber, m.Name
            ORDER BY borrowing_count DESC
        """).fetchall()
        
        staff_missing_count = 0
        print("Staff in legacy database with borrowings:")
        for phone, name, count in staff_in_legacy[:10]:  # Show top 10
            status = "✅ EXISTS" if phone in existing_staff_phones else "❌ MISSING"
            if phone not in existing_staff_phones:
                staff_missing_count += 1
            print(f"  {phone} - {name} ({count} borrowings) - {status}")
        
        total_staff_legacy = len(staff_in_legacy)
        print(f"\nTotal staff in legacy with borrowings: {total_staff_legacy}")
        print(f"Missing from new database: {staff_missing_count}")
        print(f"Successfully migrated: {total_staff_legacy - staff_missing_count}")
        
        # Check students in legacy database
        print("\nSTUDENT ANALYSIS:")
        print("=" * 50)
        
        students_in_legacy = legacy_conn.execute("""
            SELECT DISTINCT m.RollNo, m.Name, COUNT(*) as borrowing_count
            FROM MemberDetails m 
            JOIN IssueDetails i ON m.MemberID = i.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
            GROUP BY m.RollNo, m.Name
            ORDER BY borrowing_count DESC
        """).fetchall()
        
        student_missing_count = 0
        print("Students in legacy database with borrowings:")
        for roll_no, name, count in students_in_legacy[:10]:  # Show top 10
            status = "✅ EXISTS" if roll_no in existing_student_admissions else "❌ MISSING"
            if roll_no not in existing_student_admissions:
                student_missing_count += 1
            print(f"  {roll_no} - {name} ({count} borrowings) - {status}")
        
        total_students_legacy = len(students_in_legacy)
        print(f"\nTotal students in legacy with borrowings: {total_students_legacy}")
        print(f"Missing from new database: {student_missing_count}")
        print(f"Successfully migrated: {total_students_legacy - student_missing_count}")
        
        # Check all members in legacy database (not just those with borrowings)
        print("\nALL MEMBERS IN LEGACY DATABASE:")
        print("=" * 50)
        
        all_staff_legacy = legacy_conn.execute("""
            SELECT COUNT(DISTINCT PhoneNumber) 
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != '' 
                AND LENGTH(PhoneNumber) > 3
                AND PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """).fetchone()[0]
        
        all_students_legacy = legacy_conn.execute("""
            SELECT COUNT(DISTINCT RollNo) 
            FROM MemberDetails 
            WHERE (PhoneNumber IS NULL OR PhoneNumber = '' OR LENGTH(PhoneNumber) <= 3
                   OR PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND RollNo IS NOT NULL
        """).fetchone()[0]
        
        print(f"All staff in legacy database: {all_staff_legacy}")
        print(f"All students in legacy database: {all_students_legacy}")
        
        # Show some examples of missing members
        print("\nEXAMPLES OF MISSING MEMBERS:")
        print("=" * 50)
        
        print("Missing staff (with borrowings):")
        missing_staff = [
            (phone, name, count) for phone, name, count in staff_in_legacy 
            if phone not in existing_staff_phones
        ][:5]
        for phone, name, count in missing_staff:
            print(f"  {phone} - {name} ({count} borrowings)")
        
        print("\nMissing students (with borrowings):")
        missing_students = [
            (roll_no, name, count) for roll_no, name, count in students_in_legacy 
            if roll_no not in existing_student_admissions
        ][:5]
        for roll_no, name, count in missing_students:
            print(f"  {roll_no} - {name} ({count} borrowings)")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    check_missing_members()
