#!/usr/bin/env python3

import sqlite3
import uuid
from datetime import datetime

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def is_valid_phone_format(phone):
    """Check if phone is a valid phone number format (not abbreviation)"""
    if not phone:
        return False
    
    phone = phone.strip()
    
    # Skip obvious abbreviations/codes
    if len(phone) <= 3:
        return False
    
    # Skip single letters or short codes
    if phone in ['A', 'R', 'C', 'HM', 'SM', 'MR', 'WM', 'KL', 'KG', 'MG', 'WR', 'RR']:
        return False
    
    # Must contain digits
    if not any(c.isdigit() for c in phone):
        return False
    
    # Must be mostly digits (allow some formatting)
    digit_count = sum(1 for c in phone if c.isdigit())
    if digit_count < 8:  # At least 8 digits for a phone number
        return False
    
    return True

def migrate_missing_valid_staff():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        # Get existing staff phones from local database
        existing_staff_phones = set()
        staff_cursor = local_conn.execute("SELECT phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for (phone,) in staff_cursor:
            existing_staff_phones.add(phone)
        
        print(f"Existing staff in new database: {len(existing_staff_phones)}")
        
        # Get missing staff with valid phone formats
        missing_staff_query = """
            SELECT DISTINCT TRIM(m.PhoneNumber) as clean_phone, m.Name, m.RollNo
            FROM MemberDetails m 
            WHERE m.PhoneNumber IS NOT NULL AND m.PhoneNumber != ''
                AND NOT (m.PhoneNumber GLOB '[0-9]*' AND CAST(m.PhoneNumber AS INTEGER) BETWEEN 10000 AND 30000)
        """
        
        valid_missing_staff = []
        
        for row in legacy_conn.execute(missing_staff_query):
            clean_phone, name, roll_no = row
            
            if clean_phone not in existing_staff_phones and is_valid_phone_format(clean_phone):
                valid_missing_staff.append((clean_phone, name, roll_no))
        
        print(f"Valid staff to migrate: {len(valid_missing_staff)}")
        
        if valid_missing_staff:
            print(f"\nMigrating staff:")
            for phone, name, roll_no in valid_missing_staff:
                print(f"  {phone} - {name}")
        
        # Migrate valid staff
        if valid_missing_staff:
            for phone, name, roll_no in valid_missing_staff:
                # Split name into first and last
                name_parts = name.strip().split()
                first_name = name_parts[0] if name_parts else "Unknown"
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
                
                staff_id = str(uuid.uuid4())
                now = datetime.now().isoformat()
                
                # Use roll_no as staff_id only if it's not empty, otherwise use NULL
                tsc_number = roll_no if roll_no and roll_no.strip() else None
                
                local_conn.execute("""
                    INSERT INTO staff (
                        id, first_name, last_name, phone, staff_id, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (staff_id, first_name, last_name, phone, tsc_number, now, now))
            
            local_conn.commit()
            print(f"✅ Successfully migrated {len(valid_missing_staff)} staff members")
            
            # Check borrowings for these staff
            valid_phones = [phone for phone, _, _ in valid_missing_staff]
            placeholders = ','.join(['?' for _ in valid_phones])
            
            borrowings_count = legacy_conn.execute(f"""
                SELECT COUNT(*)
                FROM IssueDetails i
                JOIN MemberDetails m ON i.MemberID = m.MemberID
                WHERE TRIM(m.PhoneNumber) IN ({placeholders})
                
                UNION ALL
                
                SELECT COUNT(*)
                FROM SubmittedBooks s
                JOIN MemberDetails m ON s.MemberID = m.MemberID
                WHERE TRIM(m.PhoneNumber) IN ({placeholders})
            """, valid_phones + valid_phones).fetchall()
            
            active_borrowings = borrowings_count[0][0] if borrowings_count else 0
            returned_borrowings = borrowings_count[1][0] if len(borrowings_count) > 1 else 0
            
            print(f"\nBorrowings available for these staff:")
            print(f"  Active: {active_borrowings}")
            print(f"  Returned: {returned_borrowings}")
            print(f"  Total: {active_borrowings + returned_borrowings}")
            
            # Verify final count
            final_staff_count = local_conn.execute("SELECT COUNT(*) FROM staff").fetchone()[0]
            print(f"\nTotal staff in database now: {final_staff_count}")
        
        else:
            print("No valid staff to migrate")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        local_conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    migrate_missing_valid_staff()
