#!/usr/bin/env python3

import sqlite3
import uuid
import time
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

def migrate_borrowings_to_supabase():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    legacy_conn = sqlite3.connect(LEGACY_DB)
    
    try:
        print("🔄 Starting optimized migration from legacy database to Supabase...")
        
        # Use local database mappings instead of loading from Supabase
        local_conn = sqlite3.connect("/home/deniskariuki/.local/share/library-management-system/library.db")
        
        # Get staff mapping from local database
        print("👥 Loading staff mapping from local database...")
        staff_map = {}
        staff_cursor = local_conn.execute("SELECT id, phone FROM staff WHERE phone IS NOT NULL AND phone != ''")
        for staff_id, phone in staff_cursor:
            staff_map[phone] = staff_id
        print(f"👥 Loaded {len(staff_map)} staff members")
        
        # Get student mapping from local database
        print("🎓 Loading student mapping from local database...")
        student_map = {}
        student_cursor = local_conn.execute("SELECT id, admission_number FROM students WHERE admission_number IS NOT NULL")
        for student_id, admission_number in student_cursor:
            student_map[admission_number] = student_id
        print(f"🎓 Loaded {len(student_map)} students")
        
        # Get book_copy mapping from local database
        print("📚 Loading book copy mapping from local database...")
        copy_map = {}
        copy_cursor = local_conn.execute("""
            SELECT bc.id, bc.legacy_book_id, b.id as book_id
            FROM book_copies bc 
            JOIN books b ON bc.isbn = b.isbn 
            WHERE bc.legacy_book_id IS NOT NULL
        """)
        for copy_id, legacy_book_id, book_id in copy_cursor:
            copy_map[int(legacy_book_id)] = (copy_id, book_id)
        print(f"📚 Loaded {len(copy_map)} book copies with legacy mapping")
        
        local_conn.close()
        
        # Clear existing borrowings
        print("🗑️ Clearing existing borrowings...")
        try:
            supabase.table('borrowings').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        except:
            print("⚠️ Could not clear existing borrowings, continuing...")
        
        batch_size = 100  # Very small batches to avoid timeouts
        total_migrated = 0
        
        # Process all borrowings together for efficiency
        print("\n🔄 Processing all borrowings...")
        
        # Combined query for all borrowings
        all_borrowings_query = """
            -- Staff active borrowings
            SELECT 'staff' as type, 'active' as status, i.BookID, i.MemberID, i.IssueDate, i.DueDate, 
                   NULL as SubmitDate, 0 as Fine, m.PhoneNumber as identifier
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
            
            UNION ALL
            
            -- Staff returned borrowings
            SELECT 'staff' as type, 'returned' as status, s.BookID, s.MemberID, s.IssueDate, s.DueDate, 
                   s.SubmitDate, COALESCE(s.Fine, 0) as Fine, m.PhoneNumber as identifier
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE m.PhoneNumber IS NOT NULL 
                AND m.PhoneNumber != '' 
                AND LENGTH(m.PhoneNumber) > 3
                AND m.PhoneNumber NOT IN ('HM', 'WR', 'MG', 'KG', 'SM')
            
            UNION ALL
            
            -- Student active borrowings
            SELECT 'student' as type, 'active' as status, i.BookID, i.MemberID, i.IssueDate, i.DueDate, 
                   NULL as SubmitDate, 0 as Fine, m.RollNo as identifier
            FROM IssueDetails i
            JOIN MemberDetails m ON i.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
            
            UNION ALL
            
            -- Student returned borrowings
            SELECT 'student' as type, 'returned' as status, s.BookID, s.MemberID, s.IssueDate, s.DueDate, 
                   s.SubmitDate, COALESCE(s.Fine, 0) as Fine, m.RollNo as identifier
            FROM SubmittedBooks s
            JOIN MemberDetails m ON s.MemberID = m.MemberID
            WHERE (m.PhoneNumber IS NULL OR m.PhoneNumber = '' OR LENGTH(m.PhoneNumber) <= 3
                   OR m.PhoneNumber IN ('HM', 'WR', 'MG', 'KG', 'SM'))
              AND m.RollNo IS NOT NULL
        """
        
        batch_data = []
        skipped = 0
        
        for row in legacy_conn.execute(all_borrowings_query):
            borrower_type, status, book_id_legacy, member_id, issue_date, due_date, submit_date, fine, identifier = row
            
            # Check if we have the mappings
            if borrower_type == 'staff':
                if identifier not in staff_map:
                    skipped += 1
                    continue
                borrower_id_field = 'staff_id'
                borrower_id = staff_map[identifier]
            else:  # student
                if identifier not in student_map:
                    skipped += 1
                    continue
                borrower_id_field = 'student_id'
                borrower_id = student_map[identifier]
            
            if not is_valid_book_id(book_id_legacy) or int(book_id_legacy) not in copy_map:
                skipped += 1
                continue
            
            book_copy_id, book_id = copy_map[int(book_id_legacy)]
            
            borrowing_data = {
                'id': str(uuid.uuid4()),
                borrower_id_field: borrower_id,
                'book_id': book_id,
                'book_copy_id': book_copy_id,
                'borrowed_date': convert_date(issue_date),
                'due_date': convert_date(due_date),
                'status': status,
                'borrower_type': borrower_type,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            if status == 'returned':
                borrowing_data['returned_date'] = convert_date(submit_date)
                borrowing_data['fine_amount'] = fine
            
            batch_data.append(borrowing_data)
            
            if len(batch_data) >= batch_size:
                try:
                    supabase.table('borrowings').insert(batch_data).execute()
                    total_migrated += len(batch_data)
                    print(f"✅ Batch: {len(batch_data)} (total: {total_migrated}, skipped: {skipped})")
                    batch_data = []
                    time.sleep(0.1)  # Small delay to avoid rate limits
                except Exception as e:
                    print(f"❌ Batch failed: {e}")
                    # Try smaller batches
                    for item in batch_data:
                        try:
                            supabase.table('borrowings').insert([item]).execute()
                            total_migrated += 1
                        except:
                            skipped += 1
                    batch_data = []
        
        # Insert remaining data
        if batch_data:
            try:
                supabase.table('borrowings').insert(batch_data).execute()
                total_migrated += len(batch_data)
                print(f"✅ Final batch: {len(batch_data)} (total: {total_migrated})")
            except Exception as e:
                print(f"❌ Final batch failed: {e}")
                for item in batch_data:
                    try:
                        supabase.table('borrowings').insert([item]).execute()
                        total_migrated += 1
                    except:
                        skipped += 1
        
        print(f"\n🎉 Migration to Supabase completed!")
        print(f"📊 Total borrowings migrated: {total_migrated}")
        print(f"⚠️ Total skipped: {skipped}")
        
        # Verify final count
        try:
            final_count = supabase.table('borrowings').select('id', count='exact').execute()
            print(f"✅ Final Supabase borrowings count: {final_count.count}")
        except:
            print("⚠️ Could not verify final count")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()

if __name__ == "__main__":
    migrate_borrowings_to_supabase()
