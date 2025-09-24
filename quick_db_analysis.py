#!/usr/bin/env python3
import sqlite3
import os

def analyze_db():
    db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=== DATABASE ANALYSIS ===\n")
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print("TABLES:")
    for table in tables:
        print(f"  - {table[0]}")
    
    print("\n" + "="*50)
    
    # Analyze each table
    for table in tables:
        table_name = table[0]
        print(f"\nTABLE: {table_name}")
        
        # Get structure
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        print("  Columns:")
        for col in columns:
            print(f"    {col[1]} ({col[2]})")
        
        # Get count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"  Records: {count}")
        
        # Show sample data for smaller tables
        if count > 0 and count < 20:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
            samples = cursor.fetchall()
            if samples:
                print("  Sample data:")
                for sample in samples:
                    print(f"    {sample}")
    
    conn.close()
    print("\n=== ANALYSIS COMPLETE ===")

if __name__ == "__main__":
    analyze_db()