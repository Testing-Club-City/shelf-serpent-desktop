#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def check_all_staff():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        # Get existing staff phones from local database
        existing_staff_phones = set()
        staff_cursor = local_conn.execute("SELECT phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for (phone,) in staff_cursor:
            existing_staff_phones.add(phone)
        
        print(f"Staff phones in new database: {len(existing_staff_phones)}")
        
        # Get ALL staff from legacy (anyone with a phone number)
        all_staff_legacy = legacy_conn.execute("""
            SELECT DISTINCT m.PhoneNumber, m.Name, m.RollNo
            FROM MemberDetails m 
            WHERE m.PhoneNumber IS NOT NULL AND m.PhoneNumber != ''
            ORDER BY m.PhoneNumber
        """).fetchall()
        
        print(f"ALL staff in legacy database (with phone): {len(all_staff_legacy)}")
        
        # Check which ones are missing
        missing_staff = []
        existing_staff = []
        
        for phone, name, roll_no in all_staff_legacy:
            if phone in existing_staff_phones:
                existing_staff.append((phone, name, roll_no))
            else:
                missing_staff.append((phone, name, roll_no))
        
        print(f"Staff successfully migrated: {len(existing_staff)}")
        print(f"Staff MISSING from new database: {len(missing_staff)}")
        
        if missing_staff:
            print(f"\nMissing staff examples:")
            for phone, name, roll_no in missing_staff[:10]:
                print(f"  {phone} - {name} (TSC: {roll_no})")
        
        # Check borrowings for missing staff
        if missing_staff:
            missing_phones = [phone for phone, _, _ in missing_staff]
            placeholders = ','.join(['?' for _ in missing_phones])
            
            borrowings_count = legacy_conn.execute(f"""
                SELECT COUNT(*)
                FROM IssueDetails i
                JOIN MemberDetails m ON i.MemberID = m.MemberID
                WHERE m.PhoneNumber IN ({placeholders})
                
                UNION ALL
                
                SELECT COUNT(*)
                FROM SubmittedBooks s
                JOIN MemberDetails m ON s.MemberID = m.MemberID
                WHERE m.PhoneNumber IN ({placeholders})
            """, missing_phones + missing_phones).fetchall()
            
            active_borrowings = borrowings_count[0][0] if borrowings_count else 0
            returned_borrowings = borrowings_count[1][0] if len(borrowings_count) > 1 else 0
            
            print(f"\nBorrowings by missing staff:")
            print(f"  Active borrowings: {active_borrowings}")
            print(f"  Returned borrowings: {returned_borrowings}")
            print(f"  Total borrowings lost: {active_borrowings + returned_borrowings}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    check_all_staff()
