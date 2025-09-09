#!/usr/bin/env python3
import sqlite3

db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("📋 Book_copies table columns:")
cursor.execute("PRAGMA table_info(book_copies)")
columns = cursor.fetchall()
for col in columns:
    print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")

print("\n🔍 Sample book_copies data:")
cursor.execute("SELECT * FROM book_copies LIMIT 3")
rows = cursor.fetchall()
for row in rows:
    print(f"  - {row}")

conn.close()