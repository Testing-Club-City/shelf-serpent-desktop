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

def migrate_student_borrowings():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    new_conn = sqlite3.connect(NEW_DB)
    
    try:
        # Clear existing student borrowings
        new_conn.execute("DELETE FROM borrowings WHERE borrower_type = 'student' OR borrower_type IS NULL")
        print("Cleared existing student borrowings")
        
        # Get student mapping (RollNo -> student_id)
        student_map = {}
        student_cursor = new_conn.execute("SELECT id, admission_number FROM students WHERE admission_number IS NOT NULL")
        for student_id, admission_number in student_cursor:
            student_map[admission_number] = student_id
        
        print(f"Found {len(student_map)} students with admission numbers")
        
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
        
        # Migrate active borrowings in batches
        active_query = """
            SELECT i.BookID, i.MemberID, i.IssueDate, i.DueDate, m.RollNo
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        active_count = 0
        skipped_active = 0
        batch_data = []
        
        for row in legacy_conn.execute(active_query):
            book_id_legacy, member_id, issue_date, due_date, roll_no = row
            
            if (roll_no in student_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                borrowing_id = str(uuid.uuid4())
                student_id = student_map[roll_no]
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowed_date = convert_date(issue_date)
                due_date_converted = convert_date(due_date)
                now = datetime.now().isoformat()
                
                batch_data.append((borrowing_id, student_id, book_id, book_copy_id, borrowed_date, due_date_converted, now, now))
                
                # Insert in batches of 1000
                if len(batch_data) >= 1000:
                    new_conn.executemany("""
                        INSERT INTO borrowings (
                            id, student_id, book_id, book_copy_id, borrowed_date, due_date, 
                            status, borrower_type, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'student', ?, ?)
                    """, batch_data)
                    active_count += len(batch_data)
                    print(f"Inserted batch of {len(batch_data)} active borrowings (total: {active_count})")
                    batch_data = []
            else:
                skipped_active += 1
        
        # Insert remaining active borrowings
        if batch_data:
            new_conn.executemany("""
                INSERT INTO borrowings (
                    id, student_id, book_id, book_copy_id, borrowed_date, due_date, 
                    status, borrower_type, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'student', ?, ?)
            """, batch_data)
            active_count += len(batch_data)
            print(f"Inserted final batch of {len(batch_data)} active borrowings")
        
        # Migrate returned borrowings in batches
        returned_query = """
            SELECT s.BookID, s.MemberID, s.IssueDate, s.DueDate, s.SubmitDate, 
                   COALESCE(s.Fine, 0), m.RollNo
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        returned_count = 0
        skipped_returned = 0
        batch_data = []
        
        for row in legacy_conn.execute(returned_query):
            book_id_legacy, member_id, issue_date, due_date, submit_date, fine, roll_no = row
            
            if (roll_no in student_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                borrowing_id = str(uuid.uuid4())
                student_id = student_map[roll_no]
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowed_date = convert_date(issue_date)
                due_date_converted = convert_date(due_date)
                returned_date = convert_date(submit_date)
                now = datetime.now().isoformat()
                
                batch_data.append((borrowing_id, student_id, book_id, book_copy_id, borrowed_date, due_date_converted, returned_date, fine, now, now))
                
                # Insert in batches of 1000
                if len(batch_data) >= 1000:
                    new_conn.executemany("""
                        INSERT INTO borrowings (
                            id, student_id, book_id, book_copy_id, borrowed_date, due_date, returned_date,
                            status, fine_amount, borrower_type, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'returned', ?, 'student', ?, ?)
                    """, batch_data)
                    returned_count += len(batch_data)
                    print(f"Inserted batch of {len(batch_data)} returned borrowings (total: {returned_count})")
                    batch_data = []
            else:
                skipped_returned += 1
        
        # Insert remaining returned borrowings
        if batch_data:
            new_conn.executemany("""
                INSERT INTO borrowings (
                    id, student_id, book_id, book_copy_id, borrowed_date, due_date, returned_date,
                    status, fine_amount, borrower_type, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'returned', ?, 'student', ?, ?)
            """, batch_data)
            returned_count += len(batch_data)
            print(f"Inserted final batch of {len(batch_data)} returned borrowings")
        
        new_conn.commit()
        print(f"Migration completed:")
        print(f"- Active student borrowings: {active_count} (skipped: {skipped_active})")
        print(f"- Returned student borrowings: {returned_count} (skipped: {skipped_returned})")
        print(f"- Total migrated: {active_count + returned_count}")
        
    except Exception as e:
        print(f"Error: {e}")
        new_conn.rollback()
    finally:
        legacy_conn.close()
        new_conn.close()

if __name__ == "__main__":
    migrate_student_borrowings()
