#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

def is_valid_book_id(book_id):
    try:
        int(book_id)
        return True
    except:
        return False

def analyze_skipped_records():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    local_conn = sqlite3.connect(LOCAL_DB)
    
    try:
        # Get mappings from local database
        staff_map = {}
        staff_cursor = local_conn.execute("SELECT phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for (phone,) in staff_cursor:
            staff_map[phone] = True
        
        student_map = {}
        student_cursor = local_conn.execute("SELECT admission_number FROM students WHERE admission_number IS NOT NULL")
        for (admission_number,) in student_cursor:
            student_map[admission_number] = True
        
        copy_map = {}
        copy_cursor = local_conn.execute("SELECT legacy_book_id FROM book_copies WHERE legacy_book_id IS NOT NULL")
        for (legacy_book_id,) in copy_cursor:
            copy_map[int(legacy_book_id)] = True
        
        print(f"Available mappings:")
        print(f"- Staff phones: {len(staff_map)}")
        print(f"- Student admission numbers: {len(student_map)}")
        print(f"- Book legacy IDs: {len(copy_map)}")
        print()
        
        # Analyze skipped records
        skip_reasons = {
            'staff_no_phone_mapping': 0,
            'staff_invalid_book_id': 0,
            'staff_no_book_mapping': 0,
            'student_no_admission_mapping': 0,
            'student_invalid_book_id': 0,
            'student_no_book_mapping': 0
        }
        
        # Check staff active borrowings
        staff_active_query = """
            SELECT i.BookID, m.PhoneNumber
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        for row in legacy_conn.execute(staff_active_query):
            book_id_legacy, phone = row
            
            if phone not in staff_map:
                skip_reasons['staff_no_phone_mapping'] += 1
                continue
            
            if not is_valid_book_id(book_id_legacy):
                skip_reasons['staff_invalid_book_id'] += 1
                continue
                
            if int(book_id_legacy) not in copy_map:
                skip_reasons['staff_no_book_mapping'] += 1
        
        # Check staff returned borrowings
        staff_returned_query = """
            SELECT s.BookID, m.PhoneNumber
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        for row in legacy_conn.execute(staff_returned_query):
            book_id_legacy, phone = row
            
            if phone not in staff_map:
                skip_reasons['staff_no_phone_mapping'] += 1
                continue
            
            if not is_valid_book_id(book_id_legacy):
                skip_reasons['staff_invalid_book_id'] += 1
                continue
                
            if int(book_id_legacy) not in copy_map:
                skip_reasons['staff_no_book_mapping'] += 1
        
        # Check student active borrowings
        student_active_query = """
            SELECT i.BookID, m.RollNo
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        for row in legacy_conn.execute(student_active_query):
            book_id_legacy, roll_no = row
            
            if roll_no not in student_map:
                skip_reasons['student_no_admission_mapping'] += 1
                continue
            
            if not is_valid_book_id(book_id_legacy):
                skip_reasons['student_invalid_book_id'] += 1
                continue
                
            if int(book_id_legacy) not in copy_map:
                skip_reasons['student_no_book_mapping'] += 1
        
        # Check student returned borrowings
        student_returned_query = """
            SELECT s.BookID, m.RollNo
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        for row in legacy_conn.execute(student_returned_query):
            book_id_legacy, roll_no = row
            
            if roll_no not in student_map:
                skip_reasons['student_no_admission_mapping'] += 1
                continue
            
            if not is_valid_book_id(book_id_legacy):
                skip_reasons['student_invalid_book_id'] += 1
                continue
                
            if int(book_id_legacy) not in copy_map:
                skip_reasons['student_no_book_mapping'] += 1
        
        print("Reasons for skipped records:")
        print("=" * 40)
        total_skipped = sum(skip_reasons.values())
        
        for reason, count in skip_reasons.items():
            if count > 0:
                percentage = (count / total_skipped * 100) if total_skipped > 0 else 0
                print(f"{reason.replace('_', ' ').title()}: {count} ({percentage:.1f}%)")
        
        print(f"\nTotal skipped: {total_skipped}")
        
        # Show some examples of problematic data
        print("\nExamples of problematic data:")
        print("-" * 30)
        
        # Invalid book IDs
        print("Invalid Book IDs:")
        invalid_books = legacy_conn.execute("SELECT DISTINCT BookID FROM IssueDetails WHERE BookID LIKE '%*%' OR BookID NOT GLOB '[0-9]*' LIMIT 5").fetchall()
        for (book_id,) in invalid_books:
            print(f"  - {book_id}")
        
        # Missing staff phones
        print("\nStaff without phone mapping (sample):")
        missing_staff = legacy_conn.execute("""
            SELECT DISTINCT m.PhoneNumber, m.Name 
            FROM MemberDetails m 
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
            LIMIT 5
        """).fetchall()
        for phone, name in missing_staff:
            if phone not in staff_map:
                print(f"  - {phone} ({name})")
        
        # Missing student admission numbers
        print("\nStudents without admission mapping (sample):")
        missing_students = legacy_conn.execute("""
            SELECT DISTINCT m.RollNo, m.Name 
            FROM MemberDetails m 
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
            LIMIT 5
        """).fetchall()
        for roll_no, name in missing_students:
            if roll_no not in student_map:
                print(f"  - {roll_no} ({name})")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        legacy_conn.close()
        local_conn.close()

if __name__ == "__main__":
    analyze_skipped_records()
