#!/usr/bin/env python3

import sqlite3

LEGACY_DB = "/home/deniskariuki/Documents/kisii school.db"

def check_phone_column_content():
    legacy_conn = sqlite3.connect(LEGACY_DB)
    
    try:
        # Get ALL records with non-empty PhoneNumber
        all_phone_records = legacy_conn.execute("""
            SELECT PhoneNumber, Name, RollNo, COUNT(*) as count
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL AND PhoneNumber != ''
            GROUP BY PhoneNumber, Name, RollNo
            ORDER BY PhoneNumber
        """).fetchall()
        
        print(f"Total records with PhoneNumber: {len(all_phone_records)}")
        print("\nSample of PhoneNumber column contents:")
        print("=" * 60)
        
        # Categorize phone numbers
        categories = {
            'valid_phone': [],      # 07xxxxxxxx, 01xxxxxxxx format
            'numbers_only': [],     # Pure numbers but not phone format
            'letters': [],          # Contains letters
            'short': [],           # Too short
            'long': [],            # Too long
            'special_chars': []     # Contains special characters
        }
        
        for phone, name, roll_no, count in all_phone_records[:50]:  # Show first 50
            print(f"'{phone}' - {name} (RollNo: {roll_no}) - Count: {count}")
            
            # Categorize
            if phone.isdigit():
                if len(phone) == 10 and (phone.startswith('07') or phone.startswith('01')):
                    categories['valid_phone'].append(phone)
                elif len(phone) < 8:
                    categories['short'].append(phone)
                elif len(phone) > 12:
                    categories['long'].append(phone)
                else:
                    categories['numbers_only'].append(phone)
            elif phone.isalpha():
                categories['letters'].append(phone)
            else:
                categories['special_chars'].append(phone)
        
        print(f"\n... (showing first 50 of {len(all_phone_records)} total)")
        
        # Show categorization
        print(f"\nCategorization of PhoneNumber values:")
        print("=" * 40)
        for category, items in categories.items():
            print(f"{category.replace('_', ' ').title()}: {len(items)}")
            if items:
                print(f"  Examples: {items[:5]}")
        
        # Check if these are actually student IDs in phone column
        print(f"\nChecking if 'phone numbers' are actually student IDs:")
        print("=" * 50)
        
        # Check if numeric phone numbers match RollNo patterns
        numeric_phones = [phone for phone, _, _, _ in all_phone_records if phone.isdigit()]
        
        # Check range of numeric values
        if numeric_phones:
            numeric_values = [int(phone) for phone in numeric_phones if phone.isdigit()]
            print(f"Numeric phone values range: {min(numeric_values)} to {max(numeric_values)}")
            
            # Check how many are in typical student ID range (15000-25000)
            student_id_range = [v for v in numeric_values if 15000 <= v <= 25000]
            print(f"Values in student ID range (15000-25000): {len(student_id_range)}")
            
            # Check how many are in phone number range (starting with 07, 01)
            phone_range = [v for v in numeric_values if str(v).startswith(('07', '01')) and len(str(v)) >= 9]
            print(f"Values that look like phone numbers: {len(phone_range)}")
        
        # Show some examples where PhoneNumber looks like student ID
        print(f"\nExamples where PhoneNumber might be student ID:")
        suspicious_records = legacy_conn.execute("""
            SELECT PhoneNumber, Name, RollNo
            FROM MemberDetails 
            WHERE PhoneNumber IS NOT NULL 
                AND PhoneNumber != ''
                AND PhoneNumber GLOB '[0-9]*'
                AND CAST(PhoneNumber AS INTEGER) BETWEEN 15000 AND 25000
            LIMIT 10
        """).fetchall()
        
        for phone, name, roll_no in suspicious_records:
            print(f"  PhoneNumber: {phone}, RollNo: {roll_no}, Name: {name}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        legacy_conn.close()

if __name__ == "__main__":
    check_phone_column_content()
