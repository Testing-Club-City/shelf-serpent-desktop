#!/usr/bin/env python3
"""
Student Data Import Script
Imports student data from ALL_STUDENTS_DATA.xlsx into the library management system database
"""

import pandas as pd
import sqlite3
import uuid
from datetime import datetime
import os

# Database path
DB_PATH = r"C:\Users\Denis Kariuki\AppData\Roaming\library-management-system\library.db"
EXCEL_FILE = "ALL_STUDENTS_DATA.xlsx"

def generate_uuid():
    """Generate a UUID string"""
    return str(uuid.uuid4())

def get_current_timestamp():
    """Get current timestamp in ISO format"""
    return datetime.now().isoformat()

def split_name(full_name):
    """Split full name into first and last name"""
    if pd.isna(full_name) or not full_name.strip():
        return "Unknown", "Student"
    
    name_parts = str(full_name).strip().split()
    if len(name_parts) == 1:
        return name_parts[0], ""
    elif len(name_parts) == 2:
        return name_parts[0], name_parts[1]
    else:
        # More than 2 parts - first name is first part, last name is the rest
        return name_parts[0], " ".join(name_parts[1:])

def get_or_create_class(conn, class_name, form_level):
    """Get existing class or create new one"""
    cursor = conn.cursor()
    
    # Check if class exists
    cursor.execute("SELECT id FROM classes WHERE class_name = ?", (class_name,))
    result = cursor.fetchone()
    
    if result:
        return result[0]
    
    # Create new class
    class_id = generate_uuid()
    timestamp = get_current_timestamp()
    
    cursor.execute("""
        INSERT INTO classes (
            id, class_name, form_level, class_section, max_books_allowed, 
            is_active, created_at, updated_at, academic_level_type,
            synced, sync_version, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        class_id, class_name, form_level, class_name.split()[-1],  # Extract section from class name
        2, 1, timestamp, timestamp, 'form', 0, 1, 0
    ))
    
    print(f"✅ Created new class: {class_name}")
    return class_id

def import_students_from_excel():
    """Import all students from Excel file"""
    
    if not os.path.exists(EXCEL_FILE):
        print(f"❌ Excel file not found: {EXCEL_FILE}")
        return
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found: {DB_PATH}")
        return
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Read all sheets
        excel_data = pd.read_excel(EXCEL_FILE, sheet_name=None)
        
        total_students = 0
        updated_students = 0
        new_students = 0
        created_classes = 0
        
        for sheet_name, df in excel_data.items():
            print(f"\n📋 Processing sheet: {sheet_name}")
            
            # Extract form level from sheet name (F2 -> 2, F3 -> 3, F4 -> 4)
            if sheet_name.startswith('F'):
                form_level = int(sheet_name[1:])
            else:
                print(f"⚠️ Skipping sheet {sheet_name} - invalid format")
                continue
            
            # Skip header row and process data
            for index, row in df.iterrows():
                if index == 0:  # Skip header row
                    continue
                
                try:
                    admission_number = str(row.iloc[1]).strip()  # ADM No
                    full_name = str(row.iloc[2]).strip()        # Name
                    stream = str(row.iloc[3]).strip()           # ST (Stream)
                    house = str(row.iloc[4]).strip() if pd.notna(row.iloc[4]) else None  # HSE
                    
                    # Skip empty rows
                    if not admission_number or admission_number == 'nan':
                        continue
                    
                    # Split name
                    first_name, last_name = split_name(full_name)
                    
                    # Create class name
                    class_name = f"Form {form_level} {stream}"
                    
                    # Get or create class
                    class_id = get_or_create_class(conn, class_name, form_level)
                    
                    # Check if student exists
                    cursor.execute("SELECT id FROM students WHERE admission_number = ?", (admission_number,))
                    existing_student = cursor.fetchone()
                    
                    timestamp = get_current_timestamp()
                    
                    if existing_student:
                        # Update existing student
                        cursor.execute("""
                            UPDATE students SET
                                first_name = ?, last_name = ?, class_grade = ?, class_id = ?,
                                address = ?, updated_at = ?, synced = 0, sync_version = sync_version + 1
                            WHERE admission_number = ?
                        """, (
                            first_name, last_name, class_name, class_id, 
                            house, timestamp, admission_number
                        ))
                        updated_students += 1
                        print(f"🔄 Updated: {admission_number} - {full_name} -> {class_name}")
                    else:
                        # Create new student
                        student_id = generate_uuid()
                        cursor.execute("""
                            INSERT INTO students (
                                id, admission_number, first_name, last_name, email, phone,
                                class_grade, address, date_of_birth, enrollment_date, status,
                                created_at, updated_at, class_id, academic_year, is_repeating,
                                legacy_student_id, synced, sync_version, deleted
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            student_id, admission_number, first_name, last_name, None, None,
                            class_name, house, None, timestamp, 'active',
                            timestamp, timestamp, class_id, '2024/2025', 0,
                            None, 0, 1, 0
                        ))
                        new_students += 1
                        print(f"➕ Added: {admission_number} - {full_name} -> {class_name}")
                    
                    total_students += 1
                    
                except Exception as e:
                    print(f"❌ Error processing row {index}: {e}")
                    continue
        
        # Commit changes
        conn.commit()
        
        print(f"\n✅ Import completed successfully!")
        print(f"📊 Total students processed: {total_students}")
        print(f"➕ New students added: {new_students}")
        print(f"🔄 Students updated: {updated_students}")
        print(f"🏫 Classes created: {created_classes}")
        
    except Exception as e:
        print(f"❌ Error during import: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Starting student data import...")
    import_students_from_excel()
    print("🏁 Import process finished!")
