#!/usr/bin/env python3
"""
Fix for borrowing sync issue - corrects borrower_type and staff_id mapping
"""

import sqlite3
import asyncio
import httpx

async def fix_borrowing_sync_issue():
    """Fix the borrowing sync issue by updating local database with correct borrower_type and staff_id"""
    
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    local_db = r"C:\Users\runneradmin\AppData\Roaming\library-management-system\library.db"
    
    print("🔧 Starting borrowing sync fix...")
    
    # Step 1: Connect to local database
    conn = sqlite3.connect(local_db)
    
    try:
        # Step 2: Get all local borrowing IDs
        local_borrowing_ids = []
        for row in conn.execute("SELECT id FROM borrowings"):
            local_borrowing_ids.append(row[0])
        
        print(f"📋 Found {len(local_borrowing_ids)} borrowings in local database")
        
        # Step 3: Fetch correct borrowing data from Supabase in batches
        async with httpx.AsyncClient() as client:
            batch_size = 1000
            fixed_count = 0
            staff_count = 0
            student_count = 0
            
            for i in range(0, len(local_borrowing_ids), batch_size):
                batch_ids = local_borrowing_ids[i:i + batch_size]
                
                print(f"📥 Processing batch {i//batch_size + 1}: {len(batch_ids)} borrowings...")
                
                # Build filter for batch of IDs
                id_filter = ",".join([f'"{bid}"' for bid in batch_ids])
                
                # Fetch borrowing data from Supabase with all necessary fields
                url = f"{base_url}/borrowings?id=in.({id_filter})&select=id,borrower_type,staff_id,student_id"
                
                response = await client.get(url, headers=headers)
                
                if not response.status_code == 200:
                    print(f"❌ Failed to fetch batch: {response.status_code}")
                    continue
                
                remote_borrowings = response.json()
                
                # Step 4: Update local borrowings with correct data
                for borrowing in remote_borrowings:
                    borrowing_id = borrowing.get('id')
                    borrower_type = borrowing.get('borrower_type', 'student')
                    staff_id = borrowing.get('staff_id')
                    student_id = borrowing.get('student_id')
                    
                    # Update local borrowing with correct values
                    update_query = """
                        UPDATE borrowings 
                        SET borrower_type = ?, staff_id = ?, student_id = ?
                        WHERE id = ?
                    """
                    
                    conn.execute(update_query, (borrower_type, staff_id, student_id, borrowing_id))
                    fixed_count += 1
                    
                    if borrower_type == 'staff':
                        staff_count += 1
                    else:
                        student_count += 1
                
                # Commit batch
                conn.commit()
                print(f"✅ Fixed batch: {len(remote_borrowings)} borrowings updated")
        
        print(f"\n🎉 Borrowing sync fix completed!")
        print(f"   📊 Total fixed: {fixed_count}")
        print(f"   👥 Staff borrowings: {staff_count}")
        print(f"   🎓 Student borrowings: {student_count}")
        
        # Step 5: Verify the fix
        verification = conn.execute("""
            SELECT borrower_type, COUNT(*) 
            FROM borrowings 
            GROUP BY borrower_type
        """).fetchall()
        
        print(f"\n📈 Final verification:")
        for borrower_type, count in verification:
            print(f"   {borrower_type}: {count:,} borrowings")
        
        # Check for any remaining issues
        issues = conn.execute("""
            SELECT COUNT(*) 
            FROM borrowings 
            WHERE (borrower_type = 'staff' AND staff_id IS NULL) 
               OR (borrower_type = 'student' AND student_id IS NULL)
        """).fetchone()[0]
        
        if issues > 0:
            print(f"⚠️  {issues} borrowings still have mapping issues")
        else:
            print("✅ All borrowings now have correct mapping!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

# Also create a verification script
async def verify_fix():
    """Verify that the fix worked correctly"""
    
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    local_db = r"C:\Users\runneradmin\AppData\Roaming\library-management-system\library.db"
    
    print("🔍 Verifying borrowing sync fix...")
    
    conn = sqlite3.connect(local_db)
    
    try:
        # Local counts
        local_student = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
        local_staff = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
        local_total = conn.execute("SELECT COUNT(*) FROM borrowings").fetchone()[0]
        
        # Remote counts
        async with httpx.AsyncClient() as client:
            # Student count
            resp = await client.get(
                f"{base_url}/borrowings?borrower_type=eq.student&select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_student = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            # Staff count  
            resp = await client.get(
                f"{base_url}/borrowings?borrower_type=eq.staff&select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_staff = int(resp.headers.get("content-range", "0").split("/")[-1])
            
            # Total count
            resp = await client.get(
                f"{base_url}/borrowings?select=count",
                headers={**headers, "Prefer": "count=exact"}
            )
            remote_total = int(resp.headers.get("content-range", "0").split("/")[-1])
        
        print(f"\n📊 VERIFICATION RESULTS:")
        print(f"{'Type':<10} {'Local':<10} {'Remote':<10} {'Status'}")
        print("-" * 40)
        print(f"{'Student':<10} {local_student:<10,} {remote_student:<10,} {'✅' if local_student == remote_student else '❌'}")
        print(f"{'Staff':<10} {local_staff:<10,} {remote_staff:<10,} {'✅' if local_staff == remote_staff else '❌'}")
        print(f"{'Total':<10} {local_total:<10,} {remote_total:<10,} {'✅' if local_total == remote_total else '❌'}")
        
        # Success check
        if local_student == remote_student and local_staff == remote_staff:
            print(f"\n🎉 SUCCESS! Borrowing sync is now fixed!")
            print(f"   ✅ Student borrowings: {local_student:,}")
            print(f"   ✅ Staff borrowings: {local_staff:,}")
        else:
            print(f"\n⚠️  Issue persists - counts don't match remote")
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Borrowing Sync Issue Fix")
    print("=" * 40)
    print()
    
    # Run the fix
    asyncio.run(fix_borrowing_sync_issue())
    
    print("\n" + "=" * 40)
    print()
    
    # Verify the fix
    asyncio.run(verify_fix())
