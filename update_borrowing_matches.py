#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def update_borrowing_matches():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        # Get local mappings
        student_map = {}
        student_cursor = local_conn.execute("SELECT id, admission_number FROM students")
        for student_id, admission_number in student_cursor:
            if admission_number:
                student_map[admission_number] = student_id
        
        staff_map = {}
        staff_cursor = local_conn.execute("SELECT id, phone FROM staff")
        for staff_id, phone in staff_cursor:
            if phone:
                staff_map[phone.strip()] = staff_id
        
        print(f"Local mappings - Students: {len(student_map)}, Staff: {len(staff_map)}")
        
        # Get unmatched borrowings
        unmatched = local_conn.execute("""
            SELECT b.id, b.borrower_type, b.student_id, b.staff_id, bc.legacy_book_id
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id
            LEFT JOIN staff st ON b.staff_id = st.id
            LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE (b.borrower_type = 'student' AND s.id IS NULL) 
               OR (b.borrower_type = 'staff' AND st.id IS NULL)
        """).fetchall()
        
        print(f"Unmatched borrowings: {len(unmatched)}")
        
        fixed_count = 0
        
        for borrowing_id, borrower_type, student_id, staff_id, legacy_book_id in unmatched:
            if not legacy_book_id:
                continue
                
            # Find who borrowed this book in legacy database
            legacy_result = legacy_conn.execute("""
                SELECT m.RollNo, m.PhoneNumber, m.Name
                FROM IssueDetails i
                JOIN MemberDetails m ON i.MemberID = m.MemberID
                WHERE i.BookID = ?
                LIMIT 1
            """, (legacy_book_id,)).fetchone()
            
            if not legacy_result:
                # Try returned books
                legacy_result = legacy_conn.execute("""
                    SELECT m.RollNo, m.PhoneNumber, m.Name
                    FROM SubmittedBooks s
                    JOIN MemberDetails m ON s.MemberID = m.MemberID
                    WHERE s.BookID = ?
                    LIMIT 1
                """, (legacy_book_id,)).fetchone()
            
            if legacy_result:
                roll_no, phone, name = legacy_result
                phone = phone.strip() if phone else None
                
                # Determine if this should be staff or student
                is_staff = (phone and len(phone) > 3 and 
                           phone not in ['HM', 'WR', 'MG', 'KG', 'SM'] and
                           not (phone.isdigit() and 10000 <= int(phone) <= 30000))
                
                if is_staff and phone in staff_map:
                    # Update as staff borrowing
                    local_conn.execute("""
                        UPDATE borrowings 
                        SET borrower_type = 'staff', staff_id = ?, student_id = NULL
                        WHERE id = ?
                    """, (staff_map[phone], borrowing_id))
                    fixed_count += 1
                    
                elif not is_staff and roll_no in student_map:
                    # Update as student borrowing
                    local_conn.execute("""
                        UPDATE borrowings 
                        SET borrower_type = 'student', student_id = ?, staff_id = NULL
                        WHERE id = ?
                    """, (student_map[roll_no], borrowing_id))
                    fixed_count += 1
        
        local_conn.commit()
        print(f"Fixed {fixed_count} borrowing matches")
        
        # Final verification
        final_check = local_conn.execute("""
            SELECT 
                b.borrower_type,
                COUNT(*) as total,
                COUNT(CASE WHEN b.borrower_type = 'student' AND s.id IS NOT NULL THEN 1 END) as student_matched,
                COUNT(CASE WHEN b.borrower_type = 'staff' AND st.id IS NOT NULL THEN 1 END) as staff_matched,
                COUNT(CASE WHEN b.borrower_type = 'student' AND s.id IS NULL THEN 1 END) as student_unmatched,
                COUNT(CASE WHEN b.borrower_type = 'staff' AND st.id IS NULL THEN 1 END) as staff_unmatched
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id
            LEFT JOIN staff st ON b.staff_id = st.id
            GROUP BY b.borrower_type
        """).fetchall()
        
        print(f"\nFinal status:")
        for row in final_check:
            borrower_type, total, student_matched, staff_matched, student_unmatched, staff_unmatched = row
            print(f"{borrower_type}: {total} total, matched: {student_matched + staff_matched}, unmatched: {student_unmatched + staff_unmatched}")
        
    except Exception as e:
        print(f"Error: {e}")
        local_conn.rollback()
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    update_borrowing_matches()
