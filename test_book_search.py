import sqlite3
import os

# Test the exact query that the Rust command should execute
db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"

if not os.path.exists(db_path):
    print(f"Database not found at: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Test the exact query from search_book_copy_by_legacy_id
legacy_book_id = 200

query = """
    SELECT 
        CAST(bc.id AS TEXT) as id, bc.isbn, bc.title, bc.author, bc.publisher, bc.publication_year,
        bc.copy_identifier, bc.condition, bc.status, bc.location, bc.legacy_book_id,
        bc.created_at, bc.updated_at
    FROM book_copies bc
    WHERE bc.legacy_book_id = ? 
      AND (bc.deleted = 0 OR bc.deleted IS NULL)
      AND bc.status = 'available'
      AND bc.id NOT IN (
          SELECT book_copy_id FROM borrowings 
          WHERE status = 'active' AND book_copy_id IS NOT NULL
      )
    ORDER BY bc.created_at
    LIMIT 1
"""

print(f"Testing query for legacy_book_id = {legacy_book_id}")
print("=" * 60)

try:
    cursor.execute(query, (legacy_book_id,))
    result = cursor.fetchone()
    
    if result:
        print("Query successful! Book found:")
        columns = [desc[0] for desc in cursor.description]
        for i, value in enumerate(result):
            print(f"  {columns[i]}: {value}")
        print("\nThe database query works correctly!")
        print("The issue is likely in the Rust state management, not the database.")
    else:
        print("No book found with the given criteria")
        
        # Check if book exists but doesn't meet criteria
        cursor.execute("SELECT id, legacy_book_id, status FROM book_copies WHERE legacy_book_id = ?", (legacy_book_id,))
        exists = cursor.fetchone()
        if exists:
            print(f"Book exists but status is: {exists[2]}")
        else:
            print("Book doesn't exist in database")
            
except Exception as e:
    print(f"Query failed: {e}")

conn.close()