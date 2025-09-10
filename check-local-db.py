#!/usr/bin/env python3
import sqlite3
import os

# Local database path
DB_PATH = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"

def check_local_schema():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"Local Database: {DB_PATH}")
    print(f"Found {len(tables)} tables:\n")
    
    for table in tables:
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        
        print(f"{table} ({len(columns)} columns, {count} rows):")
        for col in columns:
            col_name, col_type, not_null, default, pk = col[1], col[2], col[3], col[4], col[5]
            flags = []
            if pk: flags.append("PK")
            if not_null: flags.append("NOT NULL")
            if default: flags.append(f"DEFAULT {default}")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            print(f"  - {col_name}: {col_type}{flag_str}")
        print()
    
    # Check borrowings specifically
    if 'borrowings' in tables:
        print("Borrowings sample data:")
        cursor.execute("SELECT * FROM borrowings LIMIT 3")
        rows = cursor.fetchall()
        if rows:
            cursor.execute("PRAGMA table_info(borrowings)")
            col_names = [col[1] for col in cursor.fetchall()]
            for i, row in enumerate(rows):
                print(f"  Record {i+1}:")
                for j, value in enumerate(row):
                    print(f"    {col_names[j]}: {value}")
                print()
        else:
            print("  No borrowing records found")
    
    conn.close()

if __name__ == "__main__":
    check_local_schema()