#!/usr/bin/env python3

import sqlite3
import uuid
from datetime import datetime

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
NEW_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def convert_date(date_str):
    if not date_str:
        return None
    try:
        day, month, year = date_str.split('/')
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except:
        return date_str

def is_valid_book_id(book_id):
    try:
        int(book_id)
        return True
    except:
        return False

def migrate_staff_borrowings():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    new_conn = sqlite3.connect(NEW_DB)
    
    try:
        new_conn.execute("DELETE FROM borrowings WHERE borrower_type = 'staff'")
        print("Cleared existing staff borrowings")
        
        # Get staff mapping
        staff_map = {}
        staff_cursor = new_conn.execute("SELECT id, phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for staff_id, phone in staff_cursor:
            staff_map[phone] = staff_id
        
        print(f"Found {len(staff_map)} staff members")
        
        # Get book_copy mapping: legacy_book_id -> (book_copy_id, book_id)
        copy_map = {}
        copy_cursor = new_conn.execute("""
            SELECT bc.id, bc.legacy_book_id, b.id as book_id
            FROM book_copies bc 
            JOIN books b ON bc.isbn = b.isbn 
            WHERE bc.legacy_book_id IS NOT NULL
        """)
        for copy_id, legacy_book_id, book_id in copy_cursor:
            copy_map[int(legacy_book_id)] = (copy_id, book_id)
        
        print(f"Found {len(copy_map)} book copies with legacy mapping")
        
        # Migrate active borrowings
        active_query = """
            SELECT i.BookID, i.MemberID, i.IssueDate, i.DueDate, m.PhoneNumber, m.Name
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        active_count = 0
        skipped_active = 0
        for row in legacy_conn.execute(active_query):
            book_id_legacy, member_id, issue_date, due_date, phone, name = row
            
            if (phone in staff_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                borrowing_id = str(uuid.uuid4())
                staff_id = staff_map[phone]
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowed_date = convert_date(issue_date)
                due_date_converted = convert_date(due_date)
                
                new_conn.execute("""
                    INSERT INTO borrowings (
                        id, staff_id, book_id, book_copy_id, borrowed_date, due_date, 
                        status, borrower_type, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'staff', ?, ?)
                """, (borrowing_id, staff_id, book_id, book_copy_id, borrowed_date, due_date_converted, 
                     datetime.now().isoformat(), datetime.now().isoformat()))
                
                active_count += 1
            else:
                skipped_active += 1
        
        # Migrate returned borrowings
        returned_query = """
            SELECT s.BookID, s.MemberID, s.IssueDate, s.DueDate, s.SubmitDate, 
                   COALESCE(s.Fine, 0), m.PhoneNumber, m.Name
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        returned_count = 0
        skipped_returned = 0
        for row in legacy_conn.execute(returned_query):
            book_id_legacy, member_id, issue_date, due_date, submit_date, fine, phone, name = row
            
            if (phone in staff_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                borrowing_id = str(uuid.uuid4())
                staff_id = staff_map[phone]
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowed_date = convert_date(issue_date)
                due_date_converted = convert_date(due_date)
                returned_date = convert_date(submit_date)
                
                new_conn.execute("""
                    INSERT INTO borrowings (
                        id, staff_id, book_id, book_copy_id, borrowed_date, due_date, returned_date,
                        status, fine_amount, borrower_type, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'returned', ?, 'staff', ?, ?)
                """, (borrowing_id, staff_id, book_id, book_copy_id, borrowed_date, due_date_converted, returned_date,
                     fine, datetime.now().isoformat(), datetime.now().isoformat()))
                
                returned_count += 1
            else:
                skipped_returned += 1
        
        new_conn.commit()
        print(f"Migration completed:")
        print(f"- Active staff borrowings: {active_count} (skipped: {skipped_active})")
        print(f"- Returned staff borrowings: {returned_count} (skipped: {skipped_returned})")
        print(f"- Total migrated: {active_count + returned_count}")
        
    except Exception as e:
        print(f"Error: {e}")
        new_conn.rollback()
    finally:
        legacy_conn.close()
        new_conn.close()

if __name__ == "__main__":
    migrate_staff_borrowings()
