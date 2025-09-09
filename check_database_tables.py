#!/usr/bin/env python3
"""
Check what tables exist in the database
"""

import sqlite3
import os

def find_database():
    """Find the SQLite database file in the correct app data directory"""
    # Use the exact path provided by the user
    db_directory = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system"
    
    # Look for database files in this directory
    db_names = ["library.db", "database.db", "app.db", "shelf-serpent.db"]
    
    print(f"🔍 Checking directory: {db_directory}")
    
    if os.path.isdir(db_directory):
        # List all files in the directory
        try:
            files = os.listdir(db_directory)
            print(f"📁 Files in directory: {files}")
        except Exception as e:
            print(f"❌ Error listing directory: {e}")
            return None
        
        for db_name in db_names:
            db_path = os.path.join(db_directory, db_name)
            if os.path.exists(db_path):
                print(f"✅ Found database at: {db_path}")
                return db_path
        
        # If no standard names found, check if there are any .db files
        for file in files:
            if file.endswith('.db'):
                db_path = os.path.join(db_directory, file)
                print(f"✅ Found database file: {db_path}")
                return db_path
    else:
        print(f"❌ Directory does not exist: {db_directory}")
    
    print("❌ No database found")
    return None

def check_tables(db_path):
    """Check what tables exist in the database"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    print(f"\n📋 Checking tables in database: {db_path}")
    
    # Get all tables
    cursor = conn.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
    """)
    
    tables = cursor.fetchall()
    print(f"📚 Found {len(tables)} tables:")
    for table in tables:
        table_name = table['name']
        print(f"  - {table_name}")
        
        # Get row count for each table
        try:
            count_cursor = conn.execute(f"SELECT COUNT(*) as count FROM {table_name}")
            count = count_cursor.fetchone()['count']
            print(f"    ({count} rows)")
            
            # Show sample data for students-like tables
            if 'student' in table_name.lower() or table_name.lower() in ['students', 'student']:
                print(f"    Sample data:")
                sample_cursor = conn.execute(f"SELECT * FROM {table_name} LIMIT 3")
                samples = sample_cursor.fetchall()
                for sample in samples:
                    print(f"      {dict(sample)}")
        except Exception as e:
            print(f"    (Error getting count: {e})")
    
    conn.close()

def main():
    db_path = find_database()
    if not db_path:
        return
    
    check_tables(db_path)

if __name__ == "__main__":
    main()