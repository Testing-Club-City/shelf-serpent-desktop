#!/usr/bin/env python3

import sqlite3
import uuid
from datetime import datetime
from supabase import create_client, Client

# Database paths
LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"

# Supabase configuration from client.ts
SUPABASE_URL = 'https://ddlzenlqkofefdwdefzm.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'

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
        
        # Clear existing borrowings
        print("🗑️ Clearing existing borrowings...")
        supabase.table('borrowings').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        batch_size = 1000
        total_migrated = 0
        
        # Migrate staff borrowings
        print("\n🔄 Migrating staff borrowings...")
        
        # Active staff borrowings
        staff_active_query = """
            SELECT i.BookID, i.MemberID, i.IssueDate, i.DueDate, m.PhoneNumber
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        staff_active_data = []
        for row in legacy_conn.execute(staff_active_query):
            book_id_legacy, member_id, issue_date, due_date, phone = row
            
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
                
                if len(staff_active_data) >= batch_size:
                    supabase.table('borrowings').insert(staff_active_data).execute()
                    total_migrated += len(staff_active_data)
                    print(f"✅ Staff active: {len(staff_active_data)} (total: {total_migrated})")
                    staff_active_data = []
        
        if staff_active_data:
            supabase.table('borrowings').insert(staff_active_data).execute()
            total_migrated += len(staff_active_data)
            print(f"✅ Staff active final: {len(staff_active_data)} (total: {total_migrated})")
        
        # Returned staff borrowings
        staff_returned_query = """
            SELECT s.BookID, s.MemberID, s.IssueDate, s.DueDate, s.SubmitDate, 
                   COALESCE(s.Fine, 0), m.PhoneNumber
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
        """
        
        staff_returned_data = []
        for row in legacy_conn.execute(staff_returned_query):
            book_id_legacy, member_id, issue_date, due_date, submit_date, fine, phone = row
            
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
                
                if len(staff_returned_data) >= batch_size:
                    supabase.table('borrowings').insert(staff_returned_data).execute()
                    total_migrated += len(staff_returned_data)
                    print(f"✅ Staff returned: {len(staff_returned_data)} (total: {total_migrated})")
                    staff_returned_data = []
        
        if staff_returned_data:
            supabase.table('borrowings').insert(staff_returned_data).execute()
            total_migrated += len(staff_returned_data)
            print(f"✅ Staff returned final: {len(staff_returned_data)} (total: {total_migrated})")
        
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
                
                if len(student_active_data) >= batch_size:
                    supabase.table('borrowings').insert(student_active_data).execute()
                    total_migrated += len(student_active_data)
                    print(f"✅ Student active: {len(student_active_data)} (total: {total_migrated})")
                    student_active_data = []
        
        if student_active_data:
            supabase.table('borrowings').insert(student_active_data).execute()
            total_migrated += len(student_active_data)
            print(f"✅ Student active final: {len(student_active_data)} (total: {total_migrated})")
        
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
                
                if len(student_returned_data) >= batch_size:
                    supabase.table('borrowings').insert(student_returned_data).execute()
                    total_migrated += len(student_returned_data)
                    print(f"✅ Student returned: {len(student_returned_data)} (total: {total_migrated})")
                    student_returned_data = []
        
        if student_returned_data:
            supabase.table('borrowings').insert(student_returned_data).execute()
            total_migrated += len(student_returned_data)
            print(f"✅ Student returned final: {len(student_returned_data)} (total: {total_migrated})")
        
        print(f"\n🎉 Migration to Supabase completed!")
        print(f"📊 Total borrowings migrated: {total_migrated}")
        
        # Verify final count
        final_count = supabase.table('borrowings').select('id', count='exact').execute()
        print(f"✅ Final Supabase borrowings count: {final_count.count}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()

if __name__ == "__main__":
    migrate_borrowings_to_supabase()
