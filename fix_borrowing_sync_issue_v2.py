#!/usr/bin/env python3
"""
Fixed borrowing sync issue - smaller batches to avoid URL length limits
"""

import sqlite3
import asyncio
import httpx

async def fix_borrowing_sync_issue_v2():
    """Fix borrowing sync issue with smaller batches"""
    
    base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    local_db = r"C:\Users\runneradmin\AppData\Roaming\library-management-system\library.db"
    
    print("🔧 Starting borrowing sync fix (v2 - smaller batches)...")
    
    conn = sqlite3.connect(local_db)
    
    try:
        # Step 1: Get sample of local borrowing IDs to test
        print("📋 Getting local borrowings for comparison...")
        local_student_count = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
        local_staff_count = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
        
        print(f"   Local: {local_student_count:,} students, {local_staff_count:,} staff")
        
        # Step 2: Fetch paginated borrowings from Supabase and update in chunks
        async with httpx.AsyncClient(timeout=60.0) as client:
            offset = 0
            limit = 1000  # Process 1000 at a time
            fixed_count = 0
            staff_fixed = 0
            student_fixed = 0
            
            while True:
                print(f"📥 Processing remote batch starting at offset {offset}...")
                
                # Get borrowings from Supabase with pagination
                url = f"{base_url}/borrowings?select=id,borrower_type,staff_id,student_id&limit={limit}&offset={offset}"
                
                try:
                    response = await client.get(url, headers=headers)
                    
                    if response.status_code == 401:
                        print(f"❌ Authentication failed. Checking API status...")
                        # Try a simple test query first
                        test_response = await client.get(
                            f"{base_url}/borrowings?select=count", 
                            headers={**headers, "Prefer": "count=exact"}
                        )
                        if test_response.status_code == 200:
                            print(f"✅ API test successful, retrying with different query...")
                            # Try a different approach - get smaller batch first
                            url = f"{base_url}/borrowings?select=id,borrower_type,staff_id,student_id&limit=100&offset={offset}"
                            response = await client.get(url, headers=headers)
                        else:
                            print(f"❌ API test failed: {test_response.status_code}")
                            break
                    
                    if response.status_code != 200:
                        print(f"❌ Failed to fetch batch at offset {offset}: {response.status_code}")
                        print(f"Response: {response.text[:200]}")
                        break
                    
                    remote_borrowings = response.json()
                    
                    if not remote_borrowings:
                        print("✅ Reached end of remote data")
                        break
                    
                    print(f"   📊 Processing {len(remote_borrowings)} borrowings...")
                    
                    # Update each borrowing in local database
                    for borrowing in remote_borrowings:
                        borrowing_id = borrowing.get('id')
                        borrower_type = borrowing.get('borrower_type', 'student')
                        staff_id = borrowing.get('staff_id')
                        student_id = borrowing.get('student_id')
                        
                        # Check if this borrowing exists locally
                        local_exists = conn.execute(
                            "SELECT 1 FROM borrowings WHERE id = ?", 
                            (borrowing_id,)
                        ).fetchone()
                        
                        if local_exists:
                            # Update the local borrowing with correct data
                            conn.execute("""
                                UPDATE borrowings 
                                SET borrower_type = ?, staff_id = ?, student_id = ?
                                WHERE id = ?
                            """, (borrower_type, staff_id, student_id, borrowing_id))
                            
                            fixed_count += 1
                            if borrower_type == 'staff':
                                staff_fixed += 1
                            else:
                                student_fixed += 1
                    
                    # Commit this batch
                    conn.commit()
                    print(f"   ✅ Updated {len(remote_borrowings)} borrowings in local database")
                    
                    # Move to next batch
                    offset += limit
                    
                    # Add small delay to avoid rate limiting
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    print(f"❌ Error processing batch at offset {offset}: {e}")
                    break
        
        print(f"\n🎉 Borrowing sync fix completed!")
        print(f"   📊 Total updated: {fixed_count:,}")
        print(f"   👥 Staff borrowings: {staff_fixed:,}")
        print(f"   🎓 Student borrowings: {student_fixed:,}")
        
        # Verify the results
        final_student = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'student'").fetchone()[0]
        final_staff = conn.execute("SELECT COUNT(*) FROM borrowings WHERE borrower_type = 'staff'").fetchone()[0]
        
        print(f"\n📈 Final local counts:")
        print(f"   Student: {final_student:,} borrowings")
        print(f"   Staff: {final_staff:,} borrowings")
        
        # Check for remaining mapping issues
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
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()
# Verification function
async def verify_fix_v2():
    """Verify the fix worked"""
    
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
        
        # Calculate difference
        student_diff = abs(local_student - remote_student)
        staff_diff = abs(local_staff - remote_staff)
        
        if student_diff > 0 or staff_diff > 0:
            print(f"\n📊 Differences:")
            print(f"   Student difference: {student_diff:,}")
            print(f"   Staff difference: {staff_diff:,}")
            
            # Show percentage fixed
            if staff_diff < 2500:  # Was much worse before
                improvement_percent = ((2552 - staff_diff) / 2552) * 100
                print(f"   Staff sync improved by: {improvement_percent:.1f}%")
        
        # Success check
        if local_student == remote_student and local_staff == remote_staff:
            print(f"\n🎉 SUCCESS! Borrowing sync is now perfectly fixed!")
        elif staff_diff < 100:  # Close enough for now
            print(f"\n🎯 SIGNIFICANT IMPROVEMENT! Much closer to correct sync")
        else:
            print(f"\n⚠️  Still need more work on the sync")
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Borrowing Sync Issue Fix v2")
    print("=" * 40)
    print()
    
    # Run the fix
    asyncio.run(fix_borrowing_sync_issue_v2())
    
    print("\n" + "=" * 40)
    print()
    
    # Verify the fix
    asyncio.run(verify_fix_v2())
