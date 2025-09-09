import pandas as pd
import os

def analyze_excel_sheets():
    file_path = "ALL_STUDENTS_DATA.xlsx"
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return
    
    try:
        # Read all sheet names
        excel_file = pd.ExcelFile(file_path)
        sheet_names = excel_file.sheet_names
        
        print(f"📊 Excel file contains {len(sheet_names)} sheets:")
        for i, sheet in enumerate(sheet_names, 1):
            print(f"  {i}. {sheet}")
        
        print("\n" + "="*50)
        
        all_students = []
        
        # Analyze each sheet
        for sheet_name in sheet_names:
            print(f"\n📋 Analyzing sheet: {sheet_name}")
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                
                # Skip if the sheet is empty or has no data
                if df.empty or len(df) <= 1:
                    print(f"  ⚠️  Sheet {sheet_name} is empty or has no data")
                    continue
                
                print(f"  📊 Rows: {len(df)}, Columns: {len(df.columns)}")
                print(f"  📝 Column names: {list(df.columns)}")
                
                # Check if this looks like student data
                if len(df) > 1:
                    print(f"  📖 First few rows:")
                    for idx, row in df.head(3).iterrows():
                        print(f"    Row {idx}: {row.tolist()}")
                    
                    # If this sheet has actual student data (not just headers)
                    if len(df) > 1:
                        # Assume first row might be headers, check if second row has actual data
                        if pd.notna(df.iloc[1, 1]) and str(df.iloc[1, 1]).isdigit():
                            # This looks like student data with admission numbers
                            form_class = sheet_name  # Use sheet name as form/class
                            
                            # Process each row starting from row 1 (skip header row 0)
                            for idx in range(1, len(df)):
                                try:
                                    row = df.iloc[idx]
                                    if pd.notna(row.iloc[1]) and pd.notna(row.iloc[2]):  # Admission number and name exist
                                        student = {
                                            'admission_number': str(row.iloc[1]).strip(),
                                            'name': str(row.iloc[2]).strip(),
                                            'class_grade': form_class,
                                            'house': str(row.iloc[4]).strip() if len(row) > 4 and pd.notna(row.iloc[4]) else '',
                                            'stream': str(row.iloc[3]).strip() if len(row) > 3 and pd.notna(row.iloc[3]) else ''
                                        }
                                        all_students.append(student)
                                except Exception as e:
                                    print(f"    ⚠️  Error processing row {idx}: {e}")
                                    continue
                
            except Exception as e:
                print(f"  ❌ Error reading sheet {sheet_name}: {e}")
                continue
        
        print(f"\n🎯 Summary:")
        print(f"Total students found: {len(all_students)}")
        
        if all_students:
            # Show sample students
            print(f"\n📝 Sample student records:")
            for i, student in enumerate(all_students[:5]):
                print(f"  {i+1}. {student}")
            
            # Group by class
            classes = {}
            for student in all_students:
                class_name = student['class_grade']
                if class_name not in classes:
                    classes[class_name] = 0
                classes[class_name] += 1
            
            print(f"\n📊 Students by class:")
            for class_name, count in sorted(classes.items()):
                print(f"  {class_name}: {count} students")
            
            # Save processed data to CSV for inspection
            df_all = pd.DataFrame(all_students)
            df_all.to_csv('processed_students.csv', index=False)
            print(f"\n💾 Processed data saved to 'processed_students.csv'")
        
    except Exception as e:
        print(f"❌ Error analyzing Excel file: {e}")

if __name__ == "__main__":
    analyze_excel_sheets()
