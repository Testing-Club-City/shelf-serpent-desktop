#!/usr/bin/env python3

import sqlite3
import uuid
from datetime import datetime
from supabase import create_client, Client

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"
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

def get_all_supabase_data(supabase, table_name, columns):
    """Get all data from Supabase table with pagination"""
    all_data = []
    page_size = 1000
    start = 0
    
    while True:
        response = supabase.table(table_name).select(columns).range(start, start + page_size - 1).execute()
        if not response.data:
            break
        all_data.extend(response.data)
        if len(response.data) < page_size:
            break
        start += page_size
        print(f"  Loaded {len(all_data)} {table_name} records...")
    
    return all_data

def migrate_borrowings_to_supabase():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    legacy_conn = sqlite3.connect(LEGACY_DB)
    
    try:
        print("🔄 Starting migration from legacy database to Supabase...")
        
        # Get all staff data
        print("👥 Loading staff data...")
        staff_data = get_all_supabase_data(supabase, 'staff', 'id, phone')
        staff_map = {}
        for staff in staff_data:
            if staff['phone']:
                staff_map[staff['phone']] = staff['id']
        print(f"👥 Loaded {len(staff_map)} staff members with phone numbers")
        
        # Get all student data
        print("🎓 Loading student data...")
        student_data = get_all_supabase_data(supabase, 'students', 'id, admission_number')
        student_map = {}
        for student in student_data:
            if student['admission_number']:
                student_map[student['admission_number']] = student['id']
        print(f"🎓 Loaded {len(student_map)} students with admission numbers")
        
        # Get all book_copy data
        print("📚 Loading book copies data...")
        copy_data = get_all_supabase_data(supabase, 'book_copies', 'id, legacy_book_id, book_id')
        copy_map = {}
        for copy in copy_data:
            if copy['legacy_book_id']:
                copy_map[int(copy['legacy_book_id'])] = (copy['id'], copy['book_id'])
        print(f"📚 Loaded {len(copy_map)} book copies with legacy mapping")
        
        # Clear existing borrowings
        print("🗑️ Clearing existing borrowings...")
        supabase.table('borrowings').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        batch_size = 500  # Smaller batches for better reliability
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
        staff_active_skipped = 0
        
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
                    print(f"✅ Staff active batch: {len(staff_active_data)} (total: {total_migrated})")
                    staff_active_data = []
            else:
                staff_active_skipped += 1
        
        if staff_active_data:
            supabase.table('borrowings').insert(staff_active_data).execute()
            total_migrated += len(staff_active_data)
            print(f"✅ Staff active final: {len(staff_active_data)} (total: {total_migrated})")
        
        print(f"Staff active: {total_migrated - staff_active_skipped} migrated, {staff_active_skipped} skipped")
        
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
        staff_returned_skipped = 0
        staff_returned_start = total_migrated
        
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
                    print(f"✅ Staff returned batch: {len(staff_returned_data)} (total: {total_migrated})")
                    staff_returned_data = []
            else:
                staff_returned_skipped += 1
        
        if staff_returned_data:
            supabase.table('borrowings').insert(staff_returned_data).execute()
            total_migrated += len(staff_returned_data)
            print(f"✅ Staff returned final: {len(staff_returned_data)} (total: {total_migrated})")
        
        print(f"Staff returned: {total_migrated - staff_returned_start} migrated, {staff_returned_skipped} skipped")
        
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
        student_active_skipped = 0
        student_active_start = total_migrated
        
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
                    print(f"✅ Student active batch: {len(student_active_data)} (total: {total_migrated})")
                    student_active_data = []
            else:
                student_active_skipped += 1
        
        if student_active_data:
            supabase.table('borrowings').insert(student_active_data).execute()
            total_migrated += len(student_active_data)
            print(f"✅ Student active final: {len(student_active_data)} (total: {total_migrated})")
        
        print(f"Student active: {total_migrated - student_active_start} migrated, {student_active_skipped} skipped")
        
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
        student_returned_skipped = 0
        student_returned_start = total_migrated
        
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
                    print(f"✅ Student returned batch: {len(student_returned_data)} (total: {total_migrated})")
                    student_returned_data = []
            else:
                student_returned_skipped += 1
        
        if student_returned_data:
            supabase.table('borrowings').insert(student_returned_data).execute()
            total_migrated += len(student_returned_data)
            print(f"✅ Student returned final: {len(student_returned_data)} (total: {total_migrated})")
        
        print(f"Student returned: {total_migrated - student_returned_start} migrated, {student_returned_skipped} skipped")
        
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
