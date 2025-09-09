#!/usr/bin/env python3
"""
Check what legacy data actually exists in Supabase
"""

import requests

def main():
    headers = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
    }
    
    # Check books with legacy data
    print("📚 Checking books for legacy data...")
    response = requests.get(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books",
        headers=headers,
        params={
            "select": "id,title,legacy_book_id,legacy_isbn",
            "limit": 10
        }
    )
    
    if response.status_code == 200:
        books = response.json()
        print(f"📊 Sample books:")
        for book in books:
            print(f"  ID: {book.get('id')}")
            print(f"  Title: {book.get('title')}")
            print(f"  Legacy Book ID: {book.get('legacy_book_id')}")
            print(f"  Legacy ISBN: {book.get('legacy_isbn')}")
            print("---")
    
    # Check book copies with legacy data
    print("\n📖 Checking book copies for legacy data...")
    response2 = requests.get(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies",
        headers=headers,
        params={
            "select": "id,legacy_book_id,book_code,tracking_code",
            "limit": 10
        }
    )
    
    if response2.status_code == 200:
        copies = response2.json()
        print(f"📊 Sample book copies:")
        for copy in copies:
            print(f"  ID: {copy.get('id')}")
            print(f"  Legacy Book ID: {copy.get('legacy_book_id')}")
            print(f"  Book Code: {copy.get('book_code')}")
            print(f"  Tracking Code: {copy.get('tracking_code')}")
            print("---")
    
    # Count records with legacy data
    print("\n📊 Counting records with legacy data...")
    
    # Books
    response3 = requests.get(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/books",
        headers=headers,
        params={
            "select": "id",
            "legacy_book_id": "not.is.null"
        }
    )
    books_with_legacy = len(response3.json()) if response3.status_code == 200 else 0
    
    # Book copies
    response4 = requests.get(
        "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/book_copies",
        headers=headers,
        params={
            "select": "id",
            "legacy_book_id": "not.is.null"
        }
    )
    copies_with_legacy = len(response4.json()) if response4.status_code == 200 else 0
    
    print(f"📚 Books with legacy_book_id: {books_with_legacy}")
    print(f"📖 Book copies with legacy_book_id: {copies_with_legacy}")

if __name__ == "__main__":
    main()
