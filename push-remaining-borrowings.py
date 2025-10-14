#!/usr/bin/env python3
import sqlite3
import asyncio
import httpx

LOCAL_DB = r"C:\Users\kariu\AppData\Roaming\library-management-system\library.db"
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

async def push_borrowings_without_book_copy_constraint():
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get borrowings without book_copy_id to avoid foreign key issues
    cursor.execute("SELECT * FROM borrowings WHERE deleted = 0 AND (book_copy_id IS NULL OR book_copy_id = '')")
    rows = cursor.fetchall()
    conn.close()
    
    print(f"Found {len(rows)} borrowings without book_copy_id to push")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        batch_size = 1000
        total_pushed = 0
        
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            
            batch_data = []
            for row in batch:
                data = {
                    "id": row["id"],
                    "student_id": row["student_id"],
                    "staff_id": row["staff_id"],
                    "book_id": row["book_id"],
                    "book_copy_id": None,  # Set to NULL to avoid constraint
                    "borrowed_date": row["borrowed_date"],
                    "due_date": row["due_date"],
                    "returned_date": row["returned_date"],
                    "status": row["status"],
                    "fine_amount": row["fine_amount"],
                    "notes": row["notes"],
                    "issued_by": row["issued_by"],
                    "returned_by": row["returned_by"],
                    "fine_paid": int(row["fine_paid"] or 0),
                    "condition_at_issue": row["condition_at_issue"],
                    "condition_at_return": row["condition_at_return"],
                    "is_lost": int(row["is_lost"] or 0),
                    "tracking_code": row["tracking_code"],
                    "return_notes": row["return_notes"],
                    "copy_condition": row["copy_condition"],
                    "group_borrowing_id": row["group_borrowing_id"],
                    "borrower_type": row["borrower_type"],
                    "borrowing_type": row["borrowing_type"],
                    "long_term_period": row["long_term_period"],
                    "short_term_period": row["short_term_period"],
                    "is_long_term": int(row["is_long_term"] or 0),
                    "synced": int(row["synced"] or 0),
                    "sync_version": row["sync_version"],
                    "deleted": int(row["deleted"] or 0)
                }
                batch_data.append(data)
            
            try:
                response = await client.post(
                    f"{SUPABASE_URL}/rest/v1/borrowings",
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=ignore-duplicates"
                    },
                    json=batch_data
                )
                
                if response.status_code in [200, 201]:
                    total_pushed += len(batch)
                    print(f"OK batch {i//batch_size + 1}: {len(batch)} records (Total: {total_pushed})")
                else:
                    print(f"ERROR batch {i//batch_size + 1}: {response.status_code}")
                    print(f"Response: {response.text[:300]}")
                    
            except Exception as e:
                print(f"ERROR batch {i//batch_size + 1}: {e}")
    
    print(f"Completed: {total_pushed} borrowings pushed")

if __name__ == "__main__":
    asyncio.run(push_borrowings_without_book_copy_constraint())