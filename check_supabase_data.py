#!/usr/bin/env python3

from supabase import create_client, Client

SUPABASE_URL = 'https://ddlzenlqkofefdwdefzm.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'

def check_supabase_data():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        # Check staff count
        staff_count = supabase.table('staff').select('id', count='exact').execute()
        print(f"👥 Staff in Supabase: {staff_count.count}")
        
        # Check students count  
        students_count = supabase.table('students').select('id', count='exact').execute()
        print(f"🎓 Students in Supabase: {students_count.count}")
        
        # Check book_copies count
        copies_count = supabase.table('book_copies').select('id', count='exact').execute()
        print(f"📚 Book copies in Supabase: {copies_count.count}")
        
        # Check book_copies with legacy_book_id
        legacy_copies_count = supabase.table('book_copies').select('id', count='exact').not_.is_('legacy_book_id', 'null').execute()
        print(f"📖 Book copies with legacy_book_id: {legacy_copies_count.count}")
        
        # Check borrowings count
        borrowings_count = supabase.table('borrowings').select('id', count='exact').execute()
        print(f"📋 Current borrowings in Supabase: {borrowings_count.count}")
        
        print("\n🔍 Sample data:")
        
        # Sample staff with phone numbers
        staff_sample = supabase.table('staff').select('id, phone').not_.is_('phone', 'null').limit(3).execute()
        print(f"Staff sample: {len(staff_sample.data)} with phone numbers")
        for staff in staff_sample.data:
            print(f"  - {staff['phone']}")
        
        # Sample students with admission numbers
        students_sample = supabase.table('students').select('id, admission_number').not_.is_('admission_number', 'null').limit(3).execute()
        print(f"Students sample: {len(students_sample.data)} with admission numbers")
        for student in students_sample.data:
            print(f"  - {student['admission_number']}")
        
        # Sample book copies with legacy IDs
        copies_sample = supabase.table('book_copies').select('id, legacy_book_id').not_.is_('legacy_book_id', 'null').limit(3).execute()
        print(f"Book copies sample: {len(copies_sample.data)} with legacy IDs")
        for copy in copies_sample.data:
            print(f"  - Legacy ID: {copy['legacy_book_id']}")
            
    except Exception as e:
        print(f"❌ Error checking Supabase data: {e}")

if __name__ == "__main__":
    check_supabase_data()
