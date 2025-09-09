#!/usr/bin/env python3

import sqlite3
import uuid
import os
from datetime import datetime
from supabase import create_client, Client

# Database paths
LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

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

def migrate_borrowings_to_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase credentials not found")
        return
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    legacy_conn = sqlite3.connect(LEGACY_DB)
    
    try:
        print("🔄 Starting migration from legacy database to Supabase...")
        
        # Get staff mapping from Supabase
        staff_response = supabase.table('staff').select('id, phone').execute()
        staff_map = {}
        for staff in staff_response.data:
            if staff['phone']:
                staff_map[staff['phone']] = staff['id']
        
        print(f"👥 Found {len(staff_map)} staff members in Supabase")
        
        # Get student mapping from Supabase
        students_response = supabase.table('students').select('id, admission_number').execute()
        student_map = {}
        for student in students_response.data:
            if student['admission_number']:
                student_map[student['admission_number']] = student['id']
        
        print(f"🎓 Found {len(student_map)} students in Supabase")
        
        # Get book_copy mapping from Supabase
        copies_response = supabase.table('book_copies').select('id, legacy_book_id, book_id').execute()
        copy_map = {}
        for copy in copies_response.data:
            if copy['legacy_book_id']:
                copy_map[int(copy['legacy_book_id'])] = (copy['id'], copy['book_id'])
        
        print(f"📚 Found {len(copy_map)} book copies with legacy mapping in Supabase")
        
        # Migrate staff borrowings
        print("\n🔄 Migrating staff borrowings...")
        
        # Active staff borrowings
        staff_active_query = """
            SELECT i.BookID, i.MemberID, i.IssueDate, i.DueDate, m.PhoneNumber, m.Name
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        staff_active_data = []
        for row in legacy_conn.execute(staff_active_query):
            book_id_legacy, member_id, issue_date, due_date, phone, name = row
            
            if (phone in staff_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowing_data = {
                    'id': str(uuid.uuid4()),
                    'staff_id': staff_map[phone],
                    'book_id': book_id,
                    'book_copy_id': book_copy_id,
                    'borrowed_date': convert_date(issue_date),
                    'due_date': convert_date(due_date),
                    'status': 'active',
                    'borrower_type': 'staff',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                staff_active_data.append(borrowing_data)
        
        # Insert staff active borrowings in batches
        batch_size = 1000
        staff_active_count = 0
        for i in range(0, len(staff_active_data), batch_size):
            batch = staff_active_data[i:i + batch_size]
            try:
                supabase.table('borrowings').upsert(batch).execute()
                staff_active_count += len(batch)
                print(f"✅ Staff active batch {i//batch_size + 1}: {len(batch)} (total: {staff_active_count})")
            except Exception as e:
                print(f"❌ Error with staff active batch: {e}")
        
        # Returned staff borrowings
        staff_returned_query = """
            SELECT s.BookID, s.MemberID, s.IssueDate, s.DueDate, s.SubmitDate, 
                   COALESCE(s.Fine, 0), m.PhoneNumber, m.Name
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        staff_returned_data = []
        for row in legacy_conn.execute(staff_returned_query):
            book_id_legacy, member_id, issue_date, due_date, submit_date, fine, phone, name = row
            
            if (phone in staff_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowing_data = {
                    'id': str(uuid.uuid4()),
                    'staff_id': staff_map[phone],
                    'book_id': book_id,
                    'book_copy_id': book_copy_id,
                    'borrowed_date': convert_date(issue_date),
                    'due_date': convert_date(due_date),
                    'returned_date': convert_date(submit_date),
                    'status': 'returned',
                    'fine_amount': fine,
                    'borrower_type': 'staff',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                staff_returned_data.append(borrowing_data)
        
        # Insert staff returned borrowings in batches
        staff_returned_count = 0
        for i in range(0, len(staff_returned_data), batch_size):
            batch = staff_returned_data[i:i + batch_size]
            try:
                supabase.table('borrowings').upsert(batch).execute()
                staff_returned_count += len(batch)
                print(f"✅ Staff returned batch {i//batch_size + 1}: {len(batch)} (total: {staff_returned_count})")
            except Exception as e:
                print(f"❌ Error with staff returned batch: {e}")
        
        # Migrate student borrowings
        print("\n🔄 Migrating student borrowings...")
        
        # Active student borrowings
        student_active_query = """
            SELECT i.BookID, i.MemberID, i.IssueDate, i.DueDate, m.RollNo
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        student_active_data = []
        for row in legacy_conn.execute(student_active_query):
            book_id_legacy, member_id, issue_date, due_date, roll_no = row
            
            if (roll_no in student_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowing_data = {
                    'id': str(uuid.uuid4()),
                    'student_id': student_map[roll_no],
                    'book_id': book_id,
                    'book_copy_id': book_copy_id,
                    'borrowed_date': convert_date(issue_date),
                    'due_date': convert_date(due_date),
                    'status': 'active',
                    'borrower_type': 'student',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                student_active_data.append(borrowing_data)
        
        # Insert student active borrowings in batches
        student_active_count = 0
        for i in range(0, len(student_active_data), batch_size):
            batch = student_active_data[i:i + batch_size]
            try:
                supabase.table('borrowings').upsert(batch).execute()
                student_active_count += len(batch)
                print(f"✅ Student active batch {i//batch_size + 1}: {len(batch)} (total: {student_active_count})")
            except Exception as e:
                print(f"❌ Error with student active batch: {e}")
        
        # Returned student borrowings
        student_returned_query = """
            SELECT s.BookID, s.MemberID, s.IssueDate, s.DueDate, s.SubmitDate, 
                   COALESCE(s.Fine, 0), m.RollNo
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        student_returned_data = []
        for row in legacy_conn.execute(student_returned_query):
            book_id_legacy, member_id, issue_date, due_date, submit_date, fine, roll_no = row
            
            if (roll_no in student_map and 
                is_valid_book_id(book_id_legacy) and 
                int(book_id_legacy) in copy_map):
                
                book_copy_id, book_id = copy_map[int(book_id_legacy)]
                
                borrowing_data = {
                    'id': str(uuid.uuid4()),
                    'student_id': student_map[roll_no],
                    'book_id': book_id,
                    'book_copy_id': book_copy_id,
                    'borrowed_date': convert_date(issue_date),
                    'due_date': convert_date(due_date),
                    'returned_date': convert_date(submit_date),
                    'status': 'returned',
                    'fine_amount': fine,
                    'borrower_type': 'student',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                student_returned_data.append(borrowing_data)
        
        # Insert student returned borrowings in batches
        student_returned_count = 0
        for i in range(0, len(student_returned_data), batch_size):
            batch = student_returned_data[i:i + batch_size]
            try:
                supabase.table('borrowings').upsert(batch).execute()
                student_returned_count += len(batch)
                print(f"✅ Student returned batch {i//batch_size + 1}: {len(batch)} (total: {student_returned_count})")
            except Exception as e:
                print(f"❌ Error with student returned batch: {e}")
        
        print(f"\n🎉 Migration to Supabase completed!")
        print(f"📊 Summary:")
        print(f"   Staff active: {staff_active_count}")
        print(f"   Staff returned: {staff_returned_count}")
        print(f"   Student active: {student_active_count}")
        print(f"   Student returned: {student_returned_count}")
        print(f"   Total: {staff_active_count + staff_returned_count + student_active_count + student_returned_count}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
    finally:
        legacy_conn.close()

if __name__ == "__main__":
    migrate_borrowings_to_supabase()
