#!/usr/bin/env python3
import sqlite3
import os

def check_database():
    db_path = "library.db"
    if not os.path.exists(db_path):
        print("Database not found at library.db")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=== DATABASE TABLES ===")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    for table in tables:
        table_name = table[0]
        print(f"\nTable: {table_name}")
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
    
    conn.close()

if __name__ == "__main__":
    check_database()