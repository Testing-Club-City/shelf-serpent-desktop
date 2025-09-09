#!/usr/bin/env python3
import os
from pathlib import Path

def find_all_databases():
    """Find all SQLite database files"""
    search_paths = [
        Path.home() / "AppData" / "Roaming",
        Path.home() / "AppData" / "Local",
        Path.cwd()
    ]
    
    found_dbs = []
    
    for base_path in search_paths:
        if not base_path.exists():
            continue
            
        print(f"\nSearching in: {base_path}")
        
        # Look for directories containing 'shelf' or 'serpent'
        try:
            for item in base_path.iterdir():
                if item.is_dir() and ("shelf" in item.name.lower() or "serpent" in item.name.lower() or "tauri" in item.name.lower()):
                    print(f"  Found app directory: {item}")
                    
                    # Look for .db files in this directory
                    for db_file in item.rglob("*.db"):
                        print(f"    Database: {db_file}")
                        found_dbs.append(db_file)
                        
                        # Check if it has data
                        try:
                            import sqlite3
                            conn = sqlite3.connect(str(db_file))
                            cursor = conn.cursor()
                            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                            tables = cursor.fetchall()
                            if tables:
                                print(f"      Tables: {[t[0] for t in tables]}")
                            else:
                                print("      Empty database")
                            conn.close()
                        except Exception as e:
                            print(f"      Error reading: {e}")
        except PermissionError:
            print(f"  Permission denied accessing {base_path}")
        except Exception as e:
            print(f"  Error: {e}")
    
    return found_dbs

if __name__ == "__main__":
    databases = find_all_databases()
    print(f"\n=== SUMMARY ===")
    print(f"Found {len(databases)} database files:")
    for db in databases:
        print(f"  {db}")