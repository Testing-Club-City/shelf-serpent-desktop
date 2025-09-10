#!/usr/bin/env python3
import sqlite3
import asyncio
import httpx

LOCAL_DB = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

async def push_book_copies():
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM book_copies WHERE deleted = 0 LIMIT 10")
    sample = cursor.fetchall()
    
    print("Sample book_copy record:")
    if sample:
        for key in sample[0].keys():
            print(f"  {key}: {sample[0][key]} ({type(sample[0][key])})")
    
    cursor.execute("SELECT * FROM book_copies WHERE deleted = 0")
    rows = cursor.fetchall()
    conn.close()
    
    print(f"\nFound {len(rows)} book_copies to push")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        batch_size = 1000
        total_pushed = 0
        
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            
            batch_data = []
            for row in batch:
                # Skip records with invalid UUID format
                try:
                    import uuid
                    uuid.UUID(str(row["id"]))  # Validate UUID format
                except ValueError:
                    continue  # Skip invalid UUIDs
                    
                data = {
                    "id": str(row["id"]),
                    "book_id": row["book_id"],
                    "isbn": row["isbn"],
                    "title": row["title"],
                    "author": row["author"],
                    "publisher": row["publisher"],
                    "publication_year": int(row["publication_year"]) if row["publication_year"] else None,
                    "copy_identifier": row["copy_identifier"],
                    "copy_number": int(row["copy_number"]) if row["copy_number"] else None,
                    "book_code": row["book_code"],
                    "tracking_code": row["tracking_code"],
                    "notes": row["notes"],
                    "acquisition_date": row["acquisition_date"],
                    "condition": row["condition"],
                    "status": row["status"],
                    "location": row["location"],
                    "department_id": int(row["department_id"]) if row["department_id"] else None,
                    "current_borrower_id": row["current_borrower_id"],
                    "borrowed_at": row["borrowed_at"],
                    "due_date": row["due_date"],
                    "legacy_book_id": int(row["legacy_book_id"]) if row["legacy_book_id"] else None,
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "synced": int(row["synced"] or 0),
                    "sync_version": int(row["sync_version"] or 1),
                    "deleted": int(row["deleted"] or 0)
                }
                batch_data.append(data)
            
            if not batch_data:  # Skip empty batches
                continue
            
            # Retry logic for network issues
            for retry in range(3):
                try:
                    response = await client.post(
                        f"{SUPABASE_URL}/rest/v1/book_copies",
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
                        break
                    else:
                        print(f"ERROR batch {i//batch_size + 1}: {response.status_code}")
                        print(f"Response: {response.text[:500]}")
                        if retry == 2:  # Last retry
                            return
                        
                except Exception as e:
                    print(f"ERROR batch {i//batch_size + 1} (retry {retry + 1}): {e}")
                    if retry == 2:  # Last retry
                        return
                    await asyncio.sleep(2)  # Wait before retry
    
    print(f"Completed: {total_pushed} book_copies pushed")

if __name__ == "__main__":
    asyncio.run(push_book_copies())