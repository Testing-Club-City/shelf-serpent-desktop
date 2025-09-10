#!/usr/bin/env python3

import os
from supabase import create_client, Client

# Supabase credentials from client.ts
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

def inspect_schema():
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Get borrowings table schema
        print("=== BORROWINGS TABLE ===")
        borrowings = supabase.table('borrowings').select('*').limit(1).execute()
        if borrowings.data:
            print("Columns:", list(borrowings.data[0].keys()))
        
        # Get books table schema  
        print("\n=== BOOKS TABLE ===")
        books = supabase.table('books').select('*').limit(1).execute()
        if books.data:
            print("Columns:", list(books.data[0].keys()))
            
        # Get book_copies table schema
        print("\n=== BOOK_COPIES TABLE ===")
        copies = supabase.table('book_copies').select('*').limit(1).execute()
        if copies.data:
            print("Columns:", list(copies.data[0].keys()))
            
        # Get students table schema
        print("\n=== STUDENTS TABLE ===")
        students = supabase.table('students').select('*').limit(1).execute()
        if students.data:
            print("Columns:", list(students.data[0].keys()))
            
        # Get staff table schema
        print("\n=== STAFF TABLE ===")
        staff = supabase.table('staff').select('*').limit(1).execute()
        if staff.data:
            print("Columns:", list(staff.data[0].keys()))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_schema()