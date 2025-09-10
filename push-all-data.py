#!/usr/bin/env python3
import sqlite3
import asyncio
import httpx

# Paths and credentials
LOCAL_DB = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

async def push_table(table_name, batch_size=1000):
    """Push a table to Supabase"""
    print(f"\nPushing {table_name}...")
    
    # Get local data
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(f"SELECT * FROM {table_name} WHERE deleted = 0")
    rows = cursor.fetchall()
    conn.close()
    
    print(f"Found {len(rows)} records in {table_name}")
    
    if not rows:
        return 0
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        total_pushed = 0
        
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            
            # Convert to JSON with data validation
            batch_data = []
            for row in batch:
                data = {}
                for key in row.keys():
                    value = row[key]
                    # Convert boolean-like integers to proper format
                    if key in ['synced', 'deleted', 'fine_paid', 'is_lost', 'is_long_term', 'is_active', 'is_repeating', 'suspended', 'is_online', 'session_valid']:
                        data[key] = int(value or 0)
                    # Fix invalid category_id
                    elif key == 'category_id' and value == 'default-category':
                        data[key] = None
                    # Fix invalid publication years
                    elif key == 'publication_year' and (not value or value < 1800 or value > 2030):
                        data[key] = None
                    # Fix book_copies numeric fields
                    elif table_name == 'book_copies':
                        if key == 'id':
                            data[key] = str(value)
                        elif key in ['copy_number', 'publication_year', 'department_id', 'legacy_book_id']:
                            data[key] = int(value) if value is not None else None
                        else:
                            data[key] = value
                    else:
                        data[key] = value
                batch_data.append(data)
            
            # Push batch
            try:
                response = await client.post(
                    f"{SUPABASE_URL}/rest/v1/{table_name}",
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
                    print(f"OK {table_name} batch {i//batch_size + 1}: {len(batch)} records (Total: {total_pushed})")
                else:
                    print(f"ERROR {table_name} batch {i//batch_size + 1}: {response.status_code}")
                    if response.text:
                        print(f"   Error: {response.text[:200]}")
                        
            except Exception as e:
                print(f"ERROR {table_name} batch {i//batch_size + 1} exception: {e}")
    
    print(f"OK {table_name} completed: {total_pushed} records pushed")
    return total_pushed

async def push_all_data():
    """Push all tables in dependency order"""
    print("Starting full data push to Supabase...")
    
    # Push in dependency order (referenced tables first)
    tables = [
        "categories",
        "classes", 
        "students",
        "staff",
        "books",
        # "book_copies",  # Skip due to Supabase constraint issues
        "borrowings",
        "fines",
        "fine_settings",
        "group_borrowings"
    ]
    
    total_records = 0
    
    for table in tables:
        try:
            count = await push_table(table)
            total_records += count
        except Exception as e:
            print(f"ERROR Failed to push {table}: {e}")
    
    print(f"\nAll done! Total records pushed: {total_records}")

if __name__ == "__main__":
    asyncio.run(push_all_data())