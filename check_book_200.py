import sqlite3
import os

# Connect to the database
db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"

if not os.path.exists(db_path):
    print(f"❌ Database not found at: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("🔍 Checking for book copy with legacy_book_id = 200...")
print("=" * 60)

# Check if book_copies table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='book_copies'")
if not cursor.fetchone():
    print("❌ book_copies table doesn't exist")
    conn.close()
    exit(1)

# Check for legacy_book_id = 200
cursor.execute("""
    SELECT id, legacy_book_id, title, author, status, copy_identifier, condition
    FROM book_copies 
    WHERE legacy_book_id = 200
""")

results = cursor.fetchall()

if results:
    print(f"✅ Found {len(results)} book copy(ies) with legacy_book_id = 200:")
    for row in results:
        print(f"  ID: {row[0]}")
        print(f"  Legacy ID: {row[1]}")
        print(f"  Title: {row[2]}")
        print(f"  Author: {row[3]}")
        print(f"  Status: {row[4]}")
        print(f"  Copy Identifier: {row[5]}")
        print(f"  Condition: {row[6]}")
        print("-" * 40)
        
        # Check if it's borrowed
        cursor.execute("""
            SELECT id, student_id, status, borrowed_date, due_date
            FROM borrowings 
            WHERE book_copy_id = ? AND status = 'active'
        """, (row[0],))
        
        borrowing = cursor.fetchone()
        if borrowing:
            print(f"  🚫 CURRENTLY BORROWED:")
            print(f"    Borrowing ID: {borrowing[0]}")
            print(f"    Student ID: {borrowing[1]}")
            print(f"    Status: {borrowing[2]}")
            print(f"    Borrowed: {borrowing[3]}")
            print(f"    Due: {borrowing[4]}")
        else:
            print(f"  ✅ AVAILABLE for borrowing")
        print("-" * 40)
else:
    print("❌ No book copy found with legacy_book_id = 200")
    
    # Check what legacy_book_ids exist around 200
    print("\n🔍 Checking nearby legacy_book_ids...")
    cursor.execute("""
        SELECT legacy_book_id, title, author, status
        FROM book_copies 
        WHERE legacy_book_id BETWEEN 190 AND 210
        ORDER BY legacy_book_id
    """)
    
    nearby = cursor.fetchall()
    if nearby:
        print("Found these nearby legacy_book_ids:")
        for row in nearby:
            print(f"  {row[0]}: {row[1]} by {row[2]} ({row[3]})")
    else:
        print("No legacy_book_ids found between 190-210")

# Show total book copies count
cursor.execute("SELECT COUNT(*) FROM book_copies")
total = cursor.fetchone()[0]
print(f"\n📊 Total book copies in database: {total}")

conn.close()