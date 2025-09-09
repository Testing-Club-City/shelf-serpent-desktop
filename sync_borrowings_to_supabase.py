#!/usr/bin/env python3

import sqlite3
import os
from supabase import create_client, Client
from datetime import datetime

# Database paths
LOCAL_DB = "/home/deniskariuki/.local/share/library-management-system/library.db"

# Supabase configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def sync_borrowings_to_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase credentials not found in environment variables")
        return
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    local_conn = sqlite3.connect(LOCAL_DB)
    local_conn.row_factory = sqlite3.Row
    
    try:
        print("🔄 Starting borrowings sync to Supabase...")
        
        # Get all borrowings from local database
        query = """
            SELECT 
                id, student_id, staff_id, book_id, book_copy_id,
                borrowed_date, due_date, returned_date, status,
                fine_amount, notes, tracking_code, borrower_type,
                condition_at_issue, condition_at_return, is_lost,
                return_notes, group_borrowing_id, issued_by, returned_by,
                created_at, updated_at, fine_paid
            FROM borrowings 
            WHERE deleted = 0
            ORDER BY created_at
        """
        
        cursor = local_conn.execute(query)
        borrowings = cursor.fetchall()
        
        print(f"📊 Found {len(borrowings)} borrowings to sync")
        
        # Process in batches of 1000
        batch_size = 1000
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
                    'borrower_type': row['borrower_type'] or 'student',
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
            
            # Upsert to Supabase
            try:
                result = supabase.table('borrowings').upsert(batch_data).execute()
                total_synced += len(batch_data)
                print(f"✅ Synced batch {i//batch_size + 1}: {len(batch_data)} borrowings (total: {total_synced})")
            except Exception as e:
                print(f"❌ Error syncing batch {i//batch_size + 1}: {e}")
                continue
        
        print(f"🎉 Sync completed! Total borrowings synced: {total_synced}")
        
        # Verify sync
        try:
            remote_count = supabase.table('borrowings').select('id', count='exact').execute()
            print(f"📊 Remote borrowings count: {remote_count.count}")
            
            staff_count = supabase.table('borrowings').select('id', count='exact').eq('borrower_type', 'staff').execute()
            student_count = supabase.table('borrowings').select('id', count='exact').eq('borrower_type', 'student').execute()
            
            print(f"👥 Staff borrowings: {staff_count.count}")
            print(f"🎓 Student borrowings: {student_count.count}")
            
        except Exception as e:
            print(f"⚠️ Could not verify sync: {e}")
        
    except Exception as e:
        print(f"❌ Sync failed: {e}")
    finally:
        local_conn.close()

if __name__ == "__main__":
    sync_borrowings_to_supabase()
