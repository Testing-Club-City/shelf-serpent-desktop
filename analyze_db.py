#!/usr/bin/env python3
import sqlite3
import json
import os

def analyze_database():
    db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Analyzing Library Management Database Structure")
        print("=" * 60)
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print(f"📊 Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
        
        print("\n" + "=" * 60)
        
        # Analyze group_borrowings table specifically
        print("🔍 GROUP BORROWINGS TABLE ANALYSIS")
        print("-" * 40)
        
        try:
            # Check if group_borrowings table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='group_borrowings'")
            if not cursor.fetchone():
                print("❌ group_borrowings table does not exist!")
                return
            
            # Get table schema
            cursor.execute("PRAGMA table_info(group_borrowings)")
            columns = cursor.fetchall()
            
            print("📋 Table Schema:")
            for col in columns:
                print(f"  {col[1]} ({col[2]}) - {'NOT NULL' if col[3] else 'NULL'} - {'PK' if col[5] else ''}")
            
            # Get sample data
            cursor.execute("SELECT COUNT(*) FROM group_borrowings")
            total_count = cursor.fetchone()[0]
            print(f"\n📊 Total Records: {total_count}")
            
            if total_count > 0:
                # Get status distribution
                cursor.execute("SELECT status, COUNT(*) FROM group_borrowings GROUP BY status")
                status_counts = cursor.fetchall()
                print("\n📈 Status Distribution:")
                for status, count in status_counts:
                    print(f"  {status}: {count}")
                
                # Get recent records
                cursor.execute("SELECT id, status, borrowed_date, due_date, returned_date, student_count FROM group_borrowings ORDER BY created_at DESC LIMIT 5")
                recent = cursor.fetchall()
                print("\n📝 Recent Records:")
                for record in recent:
                    print(f"  ID: {record[0][:8]}... | Status: {record[1]} | Borrowed: {record[2]} | Due: {record[3]} | Returned: {record[4]} | Students: {record[5]}")
                
                # Check for active group borrowings
                cursor.execute("SELECT COUNT(*) FROM group_borrowings WHERE status = 'active'")
                active_count = cursor.fetchone()[0]
                print(f"\n🔄 Active Group Borrowings: {active_count}")
                
                if active_count > 0:
                    cursor.execute("SELECT id, tracking_code, student_count, borrowed_date, due_date FROM group_borrowings WHERE status = 'active' LIMIT 3")
                    active_records = cursor.fetchall()
                    print("📋 Sample Active Records:")
                    for record in active_records:
                        print(f"  ID: {record[0][:8]}... | Code: {record[1]} | Students: {record[2]} | Due: {record[4]}")
        
        except Exception as e:
            print(f"❌ Error analyzing group_borrowings: {e}")
        
        print("\n" + "=" * 60)
        
        # Check related tables
        print("🔍 RELATED TABLES ANALYSIS")
        print("-" * 40)
        
        # Check book_copies table
        try:
            cursor.execute("SELECT COUNT(*) FROM book_copies WHERE status = 'checked_out'")
            checked_out_copies = cursor.fetchone()[0]
            print(f"📚 Checked out book copies: {checked_out_copies}")
        except:
            print("❌ Could not analyze book_copies table")
        
        # Check books table
        try:
            cursor.execute("SELECT COUNT(*) FROM books")
            total_books = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM books WHERE available_copies > 0")
            available_books = cursor.fetchone()[0]
            print(f"📖 Total books: {total_books}, Available: {available_books}")
        except:
            print("❌ Could not analyze books table")
        
        # Check students table
        try:
            cursor.execute("SELECT COUNT(*) FROM students WHERE status = 'active'")
            active_students = cursor.fetchone()[0]
            print(f"👥 Active students: {active_students}")
        except:
            print("❌ Could not analyze students table")
        
        print("\n" + "=" * 60)
        
        # Check for potential issues
        print("🔍 POTENTIAL ISSUES ANALYSIS")
        print("-" * 40)
        
        issues_found = []
        
        # Check for orphaned group borrowings
        try:
            cursor.execute("""
                SELECT COUNT(*) FROM group_borrowings gb 
                LEFT JOIN books b ON gb.book_id = b.id 
                WHERE b.id IS NULL
            """)
            orphaned_books = cursor.fetchone()[0]
            if orphaned_books > 0:
                issues_found.append(f"❌ {orphaned_books} group borrowings reference non-existent books")
        except:
            pass
        
        # Check for invalid student IDs in group borrowings
        try:
            cursor.execute("SELECT id, student_ids FROM group_borrowings WHERE status = 'active' LIMIT 5")
            for record in cursor.fetchall():
                try:
                    student_ids = json.loads(record[1]) if record[1] else []
                    if not student_ids:
                        issues_found.append(f"❌ Group borrowing {record[0][:8]}... has no student IDs")
                except:
                    issues_found.append(f"❌ Group borrowing {record[0][:8]}... has invalid student_ids format")
        except:
            pass
        
        # Check for missing required fields
        try:
            cursor.execute("SELECT COUNT(*) FROM group_borrowings WHERE tracking_code IS NULL OR tracking_code = ''")
            missing_tracking = cursor.fetchone()[0]
            if missing_tracking > 0:
                issues_found.append(f"❌ {missing_tracking} group borrowings missing tracking codes")
        except:
            pass
        
        if issues_found:
            for issue in issues_found:
                print(issue)
        else:
            print("✅ No obvious issues found in database structure")
        
        print("\n" + "=" * 60)
        print("🔍 RETURN PROCESS ANALYSIS")
        print("-" * 40)
        
        # Check if there are any constraints that might prevent returns
        try:
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='group_borrowings'")
            table_sql = cursor.fetchone()[0]
            print("📋 Table Creation SQL:")
            print(table_sql)
        except:
            print("❌ Could not get table creation SQL")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")

if __name__ == "__main__":
    analyze_database()