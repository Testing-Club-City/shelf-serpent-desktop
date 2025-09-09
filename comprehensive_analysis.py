#!/usr/bin/env python3
"""
Comprehensive Analysis Script for Library Management System
Checks all four aspects requested:
1. sync_classes_only function implementation
2. Comprehensive sync system dependency order
3. Borrowing limits validation
4. Broader sync module structure
"""

import sqlite3
import json
import os
from pathlib import Path

def get_db_path():
    """Get the database path"""
    home = Path.home()
    db_path = home / ".local/share/library-management-system/library.db"
    if not db_path.exists():
        # Try alternative path
        db_path = home / "library-management-system/library.db"
    return db_path

def analyze_classes_sync():
    """Analyze the current state of classes sync"""
    print("🏫 === ANALYSIS 1: SYNC_CLASSES_ONLY IMPLEMENTATION ===")
    
    db_path = get_db_path()
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check classes table structure
        cursor.execute("PRAGMA table_info(classes)")
        columns = cursor.fetchall()
        print(f"📊 Classes table has {len(columns)} columns:")
        
        critical_fields = ['max_books_allowed', 'is_active', 'academic_level_type']
        found_fields = []
        
        for col in columns:
            col_name = col[1]
            col_type = col[2]
            print(f"  - {col_name}: {col_type}")
            if col_name in critical_fields:
                found_fields.append(col_name)
        
        print(f"\n✅ Critical fields found: {found_fields}")
        missing_fields = [f for f in critical_fields if f not in found_fields]
        if missing_fields:
            print(f"❌ Missing critical fields: {missing_fields}")
        else:
            print("✅ All critical borrowing limit fields are present!")
        
        # Check actual data
        cursor.execute("SELECT class_name, max_books_allowed, is_active, academic_level_type FROM classes LIMIT 10")
        classes = cursor.fetchall()
        print(f"\n📚 Sample classes data ({len(classes)} records):")
        for class_data in classes:
            print(f"  - {class_data[0]}: max_books={class_data[1]}, active={class_data[2]}, type={class_data[3]}")
        
        # Check if all classes have default limit (indicating sync issue)
        cursor.execute("SELECT COUNT(*) FROM classes WHERE max_books_allowed = 2")
        default_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM classes")
        total_count = cursor.fetchone()[0]
        
        print(f"\n📊 Borrowing limits analysis:")
        print(f"  - Total classes: {total_count}")
        print(f"  - Classes with default limit (2): {default_count}")
        print(f"  - Classes with custom limits: {total_count - default_count}")
        
        if default_count == total_count and total_count > 0:
            print("⚠️  WARNING: All classes have default limit - sync may be incomplete!")
        elif default_count > total_count * 0.8:
            print("⚠️  WARNING: Most classes have default limit - sync may be incomplete!")
        else:
            print("✅ Classes have varied limits - sync appears to be working!")
            
    except Exception as e:
        print(f"❌ Error analyzing classes: {e}")
    finally:
        conn.close()

def analyze_comprehensive_sync():
    """Analyze the comprehensive sync system"""
    print("\n🔄 === ANALYSIS 2: COMPREHENSIVE SYNC SYSTEM ===")
    
    # Check if comprehensive sync files exist
    sync_files = [
        "src-tauri/src/comprehensive_sync.rs",
        "src-tauri/src/comprehensive_sync_methods.rs", 
        "src-tauri/src/comprehensive_sync_methods_part2.rs"
    ]
    
    for file_path in sync_files:
        if os.path.exists(file_path):
            print(f"✅ Found: {file_path}")
        else:
            print(f"❌ Missing: {file_path}")
    
    # Check dependency order in comprehensive sync
    try:
        with open("src-tauri/src/comprehensive_sync.rs", "r") as f:
            content = f.read()
            
        if "sync_classes" in content:
            print("✅ Classes sync is included in comprehensive sync")
        else:
            print("❌ Classes sync not found in comprehensive sync")
            
        # Look for phase structure
        phases = []
        lines = content.split('\n')
        for line in lines:
            if "PHASE" in line and "===" in line:
                phases.append(line.strip())
        
        print(f"\n📋 Sync phases found: {len(phases)}")
        for i, phase in enumerate(phases, 1):
            print(f"  {i}. {phase}")
            
        # Check if classes is in early phase (should be in Phase 1)
        phase1_content = content.split("PHASE 2")[0] if "PHASE 2" in content else ""
        if "sync_classes" in phase1_content:
            print("✅ Classes sync is in Phase 1 (correct dependency order)")
        else:
            print("⚠️  Classes sync may not be in Phase 1")
            
    except Exception as e:
        print(f"❌ Error analyzing comprehensive sync: {e}")

def analyze_borrowing_validation():
    """Analyze borrowing limits validation"""
    print("\n📚 === ANALYSIS 3: BORROWING LIMITS VALIDATION ===")
    
    db_path = get_db_path()
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check for students exceeding borrowing limits
        query = """
        SELECT 
            s.student_name,
            s.class_id,
            c.class_name,
            c.max_books_allowed,
            COUNT(b.id) as current_borrowings
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN borrowings b ON s.id = b.student_id AND b.status = 'borrowed'
        GROUP BY s.id, s.student_name, s.class_id, c.class_name, c.max_books_allowed
        HAVING COUNT(b.id) > c.max_books_allowed
        ORDER BY current_borrowings DESC
        LIMIT 20
        """
        
        cursor.execute(query)
        violations = cursor.fetchall()
        
        print(f"📊 Students exceeding borrowing limits: {len(violations)}")
        if violations:
            print("⚠️  Top violations:")
            for violation in violations[:10]:
                student_name, class_id, class_name, max_allowed, current = violation
                print(f"  - {student_name} ({class_name}): {current}/{max_allowed} books")
        else:
            print("✅ No students currently exceeding borrowing limits!")
        
        # Check total borrowing statistics
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT s.id) as total_students,
                COUNT(DISTINCT CASE WHEN b.status = 'borrowed' THEN s.id END) as students_with_books,
                COUNT(CASE WHEN b.status = 'borrowed' THEN b.id END) as total_active_borrowings
            FROM students s
            LEFT JOIN borrowings b ON s.id = b.student_id
        """)
        
        stats = cursor.fetchone()
        total_students, students_with_books, total_borrowings = stats
        
        print(f"\n📈 Borrowing statistics:")
        print(f"  - Total students: {total_students}")
        print(f"  - Students with active borrowings: {students_with_books}")
        print(f"  - Total active borrowings: {total_borrowings}")
        print(f"  - Average books per borrowing student: {total_borrowings/students_with_books if students_with_books > 0 else 0:.2f}")
        
    except Exception as e:
        print(f"❌ Error analyzing borrowing validation: {e}")
    finally:
        conn.close()

def analyze_sync_structure():
    """Analyze the broader sync module structure"""
    print("\n🏗️  === ANALYSIS 4: SYNC MODULE STRUCTURE ===")
    
    # Check all sync-related files
    sync_files = []
    src_dir = Path("src-tauri/src")
    
    if src_dir.exists():
        for file_path in src_dir.rglob("*sync*.rs"):
            sync_files.append(str(file_path.relative_to(src_dir)))
    
    print(f"📁 Found {len(sync_files)} sync-related files:")
    for file_path in sorted(sync_files):
        print(f"  - {file_path}")
    
    # Check main.rs for sync command registration
    main_rs_path = "src-tauri/src/main.rs"
    if os.path.exists(main_rs_path):
        with open(main_rs_path, "r") as f:
            main_content = f.read()
        
        sync_commands = []
        lines = main_content.split('\n')
        for line in lines:
            if "sync_" in line and "_only" in line and not line.strip().startswith("//"):
                command = line.strip().rstrip(',')
                sync_commands.append(command)
        
        print(f"\n🎯 Sync commands registered in main.rs: {len(sync_commands)}")
        for cmd in sorted(sync_commands):
            print(f"  - {cmd}")
        
        if "sync_classes_only" in sync_commands:
            print("✅ sync_classes_only is properly registered")
        else:
            print("❌ sync_classes_only is NOT registered")
    
    # Check if comprehensive sync is integrated
    if "comprehensive_sync_from_supabase" in main_content:
        print("✅ Comprehensive sync is integrated in main.rs")
    else:
        print("❌ Comprehensive sync is NOT integrated in main.rs")

def main():
    """Run comprehensive analysis"""
    print("🔍 COMPREHENSIVE LIBRARY MANAGEMENT SYSTEM ANALYSIS")
    print("=" * 60)
    
    analyze_classes_sync()
    analyze_comprehensive_sync()
    analyze_borrowing_validation()
    analyze_sync_structure()
    
    print("\n" + "=" * 60)
    print("✅ ANALYSIS COMPLETE")
    print("\nBased on our previous conversation summary:")
    print("- We fixed type mismatches in commands/mod.rs")
    print("- We enhanced sync_classes_from_supabase with critical fields")
    print("- We created comprehensive sync system with proper dependency order")
    print("- We identified 644 students exceeding limits due to incomplete sync")

if __name__ == "__main__":
    main()
