#!/usr/bin/env python3

import sqlite3
from supabase import create_client, Client

LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"
SUPABASE_URL = 'https://ddlzenlqkofefdwdefzm.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU'

def push_borrowings_to_supabase():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    local_conn = sqlite3.connect(LOCAL_DB)
    local_conn.row_factory = sqlite3.Row
    
    try:
        print("🔄 Pushing borrowings to Supabase...")
        
        # Clear existing borrowings in Supabase
        print("🗑️ Clearing existing borrowings...")
        supabase.table('borrowings').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        # Get all borrowings from local database
        borrowings = local_conn.execute("""
            SELECT 
                id, student_id, staff_id, book_id, book_copy_id,
                borrowed_date, due_date, returned_date, status,
                fine_amount, notes, tracking_code, borrower_type,
                condition_at_issue, condition_at_return, is_lost,
                return_notes, group_borrowing_id, issued_by, returned_by,
                created_at, updated_at, fine_paid
            FROM borrowings 
            ORDER BY created_at
        """).fetchall()
        
        print(f"📊 Found {len(borrowings)} borrowings to sync")
        
        # Process in batches
        batch_size = 100
        total_synced = 0
        
        for i in range(0, len(borrowings), batch_size):
            batch = borrowings[i:i + batch_size]
            batch_data = []
            
            for row in batch:
                borrowing_data = {
                    'id': row['id'],
                    'student_id': row['student_id'],
                    'staff_id': row['staff_id'],
                    'book_id': row['book_id'],
                    'book_copy_id': row['book_copy_id'],
                    'borrowed_date': row['borrowed_date'],
                    'due_date': row['due_date'],
                    'returned_date': row['returned_date'],
                    'status': row['status'],
                    'fine_amount': row['fine_amount'] or 0,
                    'notes': row['notes'],
                    'tracking_code': row['tracking_code'],
                    'borrower_type': row['borrower_type'],
                    'condition_at_issue': row['condition_at_issue'],
                    'condition_at_return': row['condition_at_return'],
                    'is_lost': bool(row['is_lost']) if row['is_lost'] is not None else False,
                    'return_notes': row['return_notes'],
                    'group_borrowing_id': row['group_borrowing_id'],
                    'issued_by': row['issued_by'],
                    'returned_by': row['returned_by'],
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at'],
                    'fine_paid': bool(row['fine_paid']) if row['fine_paid'] is not None else False
                }
                batch_data.append(borrowing_data)
            
            # Insert batch to Supabase
            supabase.table('borrowings').insert(batch_data).execute()
            total_synced += len(batch_data)
            print(f"✅ Synced batch {i//batch_size + 1}: {len(batch_data)} borrowings (total: {total_synced})")
        
        print(f"🎉 Successfully synced {total_synced} borrowings to Supabase!")
        
        # Verify sync
        remote_count = supabase.table('borrowings').select('id', count='exact').execute()
        print(f"📊 Remote borrowings count: {remote_count.count}")
        
        staff_count = supabase.table('borrowings').select('id', count='exact').eq('borrower_type', 'staff').execute()
        student_count = supabase.table('borrowings').select('id', count='exact').eq('borrower_type', 'student').execute()
        
        print(f"👥 Staff borrowings: {staff_count.count}")
        print(f"🎓 Student borrowings: {student_count.count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        local_conn.close()

if __name__ == "__main__":
    push_borrowings_to_supabase()
