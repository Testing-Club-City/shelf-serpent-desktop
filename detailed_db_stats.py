#!/usr/bin/env python3
import sqlite3
import os

def detailed_analysis():
    db_path = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=== DETAILED DATABASE STATISTICS ===\n")
    
    # Book and copy statistics
    print("📚 BOOKS & COPIES:")
    cursor.execute("SELECT COUNT(*) FROM books")
    total_books = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies")
    total_copies = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE status = 'available'")
    available_copies = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM book_copies WHERE status = 'borrowed'")
    borrowed_copies = cursor.fetchone()[0]
    
    print(f"  Total unique books: {total_books:,}")
    print(f"  Total book copies: {total_copies:,}")
    print(f"  Available copies: {available_copies:,}")
    print(f"  Currently borrowed: {borrowed_copies:,}")
    
    # Student and staff statistics
    print("\n👥 USERS:")
    cursor.execute("SELECT COUNT(*) FROM students WHERE status = 'active'")
    active_students = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM students")
    total_students = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM staff WHERE status = 'active'")
    active_staff = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM staff")
    total_staff = cursor.fetchone()[0]
    
    print(f"  Active students: {active_students:,}")
    print(f"  Total students: {total_students:,}")
    print(f"  Active staff: {active_staff:,}")
    print(f"  Total staff: {total_staff:,}")
    
    # Borrowing statistics
    print("\n📖 BORROWINGS:")
    cursor.execute("SELECT COUNT(*) FROM borrowings")
    total_borrowings = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM borrowings WHERE status = 'borrowed'")
    active_borrowings = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM borrowings WHERE status = 'returned'")
    returned_borrowings = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM borrowings WHERE status = 'overdue'")
    overdue_borrowings = cursor.fetchone()[0]
    
    print(f"  Total borrowing records: {total_borrowings:,}")
    print(f"  Currently borrowed: {active_borrowings:,}")
    print(f"  Returned: {returned_borrowings:,}")
    print(f"  Overdue: {overdue_borrowings:,}")
    
    # Group borrowings
    cursor.execute("SELECT COUNT(*) FROM group_borrowings")
    group_borrowings = cursor.fetchone()[0]
    print(f"  Group borrowings: {group_borrowings:,}")
    
    # Sync status
    print("\n🔄 SYNC STATUS:")
    cursor.execute("SELECT table_name, synced_records, total_records FROM sync_state WHERE total_records > 0")
    sync_data = cursor.fetchall()
    
    if sync_data:
        for table, synced, total in sync_data:
            percentage = (synced / total * 100) if total > 0 else 0
            print(f"  {table}: {synced:,}/{total:,} ({percentage:.1f}%)")
    else:
        print("  No sync data available")
    
    # Recent activity
    print("\n📅 RECENT ACTIVITY:")
    cursor.execute("""
        SELECT DATE(borrowed_date) as date, COUNT(*) as count
        FROM borrowings 
        WHERE borrowed_date >= date('now', '-30 days')
        GROUP BY DATE(borrowed_date)
        ORDER BY date DESC
        LIMIT 10
    """)
    
    recent_activity = cursor.fetchall()
    if recent_activity:
        print("  Recent borrowings (last 30 days):")
        for date, count in recent_activity:
            print(f"    {date}: {count} borrowings")
    else:
        print("  No recent borrowing activity")
    
    # Top borrowed books
    print("\n🏆 TOP BORROWED BOOKS:")
    cursor.execute("""
        SELECT b.title, b.author, COUNT(*) as borrow_count
        FROM borrowings br
        JOIN books b ON br.book_id = b.id
        GROUP BY b.id, b.title, b.author
        ORDER BY borrow_count DESC
        LIMIT 10
    """)
    
    top_books = cursor.fetchall()
    if top_books:
        for i, (title, author, count) in enumerate(top_books, 1):
            title_short = title[:40] + "..." if len(title) > 40 else title
            print(f"  {i:2d}. {title_short} by {author} ({count} times)")
    
    # Class distribution
    print("\n🏫 CLASS DISTRIBUTION:")
    cursor.execute("""
        SELECT c.class_name, COUNT(s.id) as student_count
        FROM classes c
        LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
        WHERE c.is_active = 1
        GROUP BY c.id, c.class_name
        ORDER BY c.class_name
    """)
    
    class_dist = cursor.fetchall()
    if class_dist:
        for class_name, count in class_dist[:15]:  # Show first 15 classes
            print(f"  {class_name}: {count} students")
        if len(class_dist) > 15:
            print(f"  ... and {len(class_dist) - 15} more classes")
    
    conn.close()
    print("\n=== ANALYSIS COMPLETE ===")

if __name__ == "__main__":
    detailed_analysis()