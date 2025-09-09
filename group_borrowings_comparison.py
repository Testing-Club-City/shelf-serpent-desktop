#!/usr/bin/env python3
"""
Compare group_borrowings between local SQLite and Supabase
Usage: python group_borrowings_comparison.py
"""

import sqlite3
import os
import requests

# Configuration
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

# Add basic logging
try:
    import logging
    logging.basicConfig(level=logging.INFO, filename='group_borrowings_comparison.log', filemode='w', format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger(__name__)
except Exception as e:
    print(f"Error setting up logging: {e}")

def get_local_db_path():
    """Get the local SQLite database path"""
    logger.info("Getting local DB path")
    return os.path.expanduser(r"~\AppData\Roaming\shelf-serpent\library.db")

def get_supabase_data(endpoint, select_query="*"):
    """Get data from Supabase using Range headers"""
    logger.info(f"Fetching data from Supabase endpoint: {endpoint}")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_records = []
    batch_size = 1000
    offset = 0
    
    while True:
        start = offset
        end = offset + batch_size - 1
        
        headers["Range"] = f"{start}-{end}"
        
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}?select={select_query}"
        logger.info(f"Requesting data from {url} with range {start}-{end}")
        
        try:
            response = requests.get(url, headers=headers)
            logger.info(f"Response status code: {response.status_code}")
            
            if response.status_code not in [200, 206]:
                logger.error(f"Failed to fetch data, status code: {response.status_code}")
                return []
            
            batch = response.json()
            
            if not batch:
                break
                
            all_records.extend(batch)
            offset += len(batch)
            
            if len(batch) < batch_size:
                break
        except Exception as e:
            logger.error(f"Error fetching data from Supabase: {e}")
            return []
    
    logger.info(f"Fetched {len(all_records)} records from Supabase")
    return all_records

def get_local_data(table_name):
    """Get data from local SQLite"""
    logger.info(f"Fetching data from local table: {table_name}")
    db_path = get_local_db_path()
    
    if not os.path.exists(db_path):
        logger.error(f"Database path does not exist: {db_path}")
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute(f"SELECT * FROM {table_name}")
        data = cursor.fetchall()
        
        cursor.execute(f"PRAGMA table_info({table_name});")
        schema = cursor.fetchall()
        
        conn.close()
        
        logger.info(f"Fetched {len(data)} records from local {table_name}")
        return {
            'data': data,
            'schema': schema,
            'count': len(data)
        }
        
    except Exception as e:
        logger.error(f"Error fetching data from local database: {e}")
        return {'error': str(e)}

def show_group_borrowings_comparison():
    """Show comparison for group_borrowings between local and Supabase"""
    logger.info("Starting group borrowings comparison")
    print("🔍 GROUP BORROWINGS SYNC COMPARISON")
    print("=" * 40)
    
    # Local group_borrowings
    local_gb = get_local_data('group_borrowings')
    if local_gb and 'error' not in local_gb:
        print(f"Local Group Borrowings: {local_gb['count']}")
        if local_gb['data']:
            print("Local Group Borrowings Sample:")
            for gb in local_gb['data'][:3]:
                print(f"  {gb}")
    else:
        print("Local Group Borrowings: Error or not found")
        if local_gb and 'error' in local_gb:
            print(f"Error: {local_gb['error']}")
    
    # Supabase group_borrowings
    supabase_gb = get_supabase_data('group_borrowings')
    print(f"Supabase Group Borrowings: {len(supabase_gb)}")
    if supabase_gb:
        print("Supabase Group Borrowings Sample:")
        for gb in supabase_gb[:3]:
            print(f"  {gb}")
    
    # Summary
    print("\n📊 SUMMARY:")
    print("-" * 30)
    
    local_count = local_gb['count'] if local_gb and 'error' not in local_gb else 0
    supabase_count = len(supabase_gb)
    
    print(f"Missing Group Borrowings: {supabase_count - local_count:,}")
    print(f"Sync Status: {'Complete' if local_count == supabase_count else 'Incomplete'}")
    logger.info("Completed group borrowings comparison")

if __name__ == "__main__":
    try:
        show_group_borrowings_comparison()
    except Exception as e:
        print(f"Error in main execution: {e}")
        if 'logger' in globals():
            logger.error(f"Error in main execution: {e}", exc_info=True)
