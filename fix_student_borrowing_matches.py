#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def fix_student_borrowing_matches():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        # Get student mapping
        student_map = {}
        student_cursor = local_conn.execute("SELECT id, admission_number FROM students WHERE admission_number IS NOT NULL")
        for student_id, admission_number in student_cursor:
            student_map[admission_number] = student_id
        
        print(f"Student mapping available: {len(student_map)}")
        
        # Get borrowings without student_id
        unmatched_borrowings = local_conn.execute("""
            SELECT b.id, b.book_copy_id, bc.legacy_book_id
            FROM borrowings b
            JOIN book_copies bc ON b.book_copy_id = bc.id
            WHERE b.borrower_type = 'student' AND b.student_id IS NULL
        """).fetchall()
        
        print(f"Unmatched student borrowings: {len(unmatched_borrowings)}")
        
        fixed_count = 0
        
        for borrowing_id, book_copy_id, legacy_book_id in unmatched_borrowings:
            # Find the student who borrowed this book in legacy database
            student_result = legacy_conn.execute("""
                SELECT m.RollNo
                FROM IssueDetails i
                JOIN MemberDetails m ON i.MemberID = m.MemberID
                WHERE i.BookID = ?
                    AND (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                         OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
                    AND m.RollNo IS NOT NULL
                LIMIT 1
            """, (legacy_book_id,)).fetchone()
            
            if student_result and student_result[0] in student_map:
                roll_no = student_result[0]
                student_id = student_map[roll_no]
                
                # Update the borrowing
                local_conn.execute("""
                    UPDATE borrowings 
                    SET student_id = ? 
                    WHERE id = ?
                """, (student_id, borrowing_id))
                
                fixed_count += 1
        
        local_conn.commit()
        print(f"Fixed {fixed_count} borrowing matches")
        
        # Verify results
        final_check = local_conn.execute("""
            SELECT 
                COUNT(*) as total_borrowings,
                COUNT(s.id) as with_student_match,
                COUNT(*) - COUNT(s.id) as without_student_match
            FROM borrowings b
            LEFT JOIN students s ON b.student_id = s.id
            WHERE b.borrower_type = 'student'
        """).fetchone()
        
        print(f"Final status:")
        print(f"  Total student borrowings: {final_check[0]}")
        print(f"  With student match: {final_check[1]}")
        print(f"  Without student match: {final_check[2]}")
        
    except Exception as e:
        print(f"Error: {e}")
        local_conn.rollback()
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    fix_student_borrowing_matches()
