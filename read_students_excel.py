import pandas as pd
import sys

try:
    # Read the Excel file
    df = pd.read_excel('ALL_STUDENTS_DATA.xlsx')
    
    print("📊 Student Data File Information:")
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print("\n📋 Column names:")
    for i, col in enumerate(df.columns):
        print(f"{i+1}. {col}")
    
    print("\n📝 First 5 rows of data:")
    print(df.head().to_string())
    
    print("\n📊 Data types:")
    print(df.dtypes)
    
    print("\n📈 Summary statistics:")
    print(df.describe(include='all'))
    
except FileNotFoundError:
    print("❌ File 'ALL_STUDENTS_DATA.xlsx' not found in the current directory")
except Exception as e:
    print(f"❌ Error reading file: {e}")
