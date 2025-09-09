#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"

def check_student_ids_in_phone():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    
    try:
        # Check all records where PhoneNumber looks like student ID
        student_ids_in_phone = legacy_conn.execute("""
            SELECT PhoneNumber, Name, RollNo, MemberID
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND PhoneNumber GLOB '[0-9]*'
                AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000
            ORDER BY CAST(PhoneNumber AS INTEGER)
        """).fetchall()
        
        print(f"Records with student IDs in PhoneNumber column: {len(student_ids_in_phone)}")
        print("\nAll records where PhoneNumber looks like student ID:")
        print("=" * 70)
        
        for phone, name, roll_no, member_id in student_ids_in_phone:
            match_status = "MATCHES RollNo" if phone == roll_no else f"RollNo: {roll_no}"
            print(f"PhoneNumber: {phone} | {name} | {match_status} | MemberID: {member_id}")
        
        # Check if these have borrowings
        if student_ids_in_phone:
            phone_list = [phone for phone, _, _, _ in student_ids_in_phone]
            placeholders = ','.join(['?' for _ in phone_list])
            
            borrowings = legacy_conn.execute(f"""
                SELECT m.PhoneNumber, m.Name, COUNT(*) as borrowing_count
                FROM MemberDetails m
                JOIN IssueDetails i ON m.MemberID = i.MemberID
                WHERE m.PhoneNumber IN ({placeholders})
                GROUP BY m.PhoneNumber, m.Name
                
                UNION ALL
                
                SELECT m.PhoneNumber, m.Name, COUNT(*) as borrowing_count
                FROM MemberDetails m
                JOIN SubmittedBooks s ON m.MemberID = s.MemberID
                WHERE m.PhoneNumber IN ({placeholders})
                GROUP BY m.PhoneNumber, m.Name
            """, phone_list + phone_list).fetchall()
            
            print(f"\nBorrowings by these records:")
            for phone, name, count in borrowings:
                print(f"  {phone} - {name}: {count} borrowings")
        
        # Now check actual phone numbers (not student IDs)
        actual_phones = legacy_conn.execute("""
            SELECT COUNT(*)
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND NOT (PhoneNumber GLOB '[0-9]*' AND CAST(PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000)
        """).fetchone()[0]
        
        print(f"\nActual staff with real phone numbers: {actual_phones}")
        print(f"Student IDs mistakenly in phone column: {len(student_ids_in_phone)}")
        print(f"Total records with PhoneNumber: {actual_phones + len(student_ids_in_phone)}")
        
        # Show breakdown of what should be staff vs students
        print(f"\nCorrect classification:")
        print(f"- Real staff (with phone numbers): {actual_phones}")
        print(f"- Students (IDs in wrong column): {len(student_ids_in_phone)}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()

if __name__ == "__main__":
    check_student_ids_in_phone()
