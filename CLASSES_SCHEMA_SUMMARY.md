# 📊 Classes Schema Analysis Report

## ✅ Executive Summary

Successfully checked both **Supabase** and **local SQLite** classes schemas using CLI tools. **Major schema mismatch discovered** between the two databases.

## 🔍 Supabase Classes Schema

**✅ Status**: Table exists with 26 classes
**📍 Location**: `https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1/classes`

### 📋 Schema Structure
```sql
CREATE TABLE public.classes (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    instructor_id UUID REFERENCES auth.users(id),
    max_capacity INTEGER CHECK (max_capacity > 0),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 🔒 Security Features
- **Row Level Security**: ENABLED
- **Policies**: View active classes, Instructors manage own classes
- **Indexes**: `idx_classes_instructor` on `instructor_id`
- **Triggers**: `update_classes_modtime` for `updated_at`

### 📊 Data Summary
- **Total Classes**: 26
- **All classes named**: "Unnamed" (indicating data quality issue)
- **Subject**: All marked as "No subject"

## 🔍 Local SQLite Classes Schema

**✅ Status**: Table exists but **EMPTY** (0 classes)
**📍 Location**: `C:\Users\Denis Kariuki\AppData\Roaming\shelf-serpent\library.db`

### 📋 Schema Structure
```sql
CREATE TABLE classes (
    id TEXT PRIMARY KEY,
    class_name TEXT NOT NULL UNIQUE,
    form_level INTEGER NOT NULL,
    class_section TEXT,
    max_books_allowed INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    academic_level_type TEXT DEFAULT 'form',
    synced INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
);
```

## ⚠️ Critical Schema Mismatch

**The schemas represent completely different concepts:**

| Aspect | Supabase | Local SQLite |
|--------|----------|--------------|
| **Concept** | Educational courses/classes | School class groups |
| **ID Type** | BIGINT auto-increment | TEXT (manual) |
| **Naming** | `name`, `subject` | `class_name`, `form_level` |
| **Structure** | Course-based | Grade-based |
| **Example** | "Mathematics 101" | "Form 1A", "Form 2B" |
| **Capacity** | `max_capacity` students | `max_books_allowed` books |
| **Time** | `start_date`, `end_date` | No time fields |

## 🎯 CLI Tools Created

### 1. **Python CLI Tool**
```bash
python check_classes_cli.py
```
- ✅ Checks Supabase schema directly
- ✅ Shows sample data
- ✅ Displays security features

### 2. **Schema Comparison Tool**
```bash
python schema_comparison.py
```
- ✅ Compares both schemas
- ✅ Shows data counts
- ✅ Highlights differences

### 3. **Shell Script**
```bash
./check_classes.sh
```
- ✅ Direct curl-based checking
- ✅ Works on Windows with Git Bash

## 🚨 Key Findings

1. **Schema Mismatch**: The databases represent different concepts
2. **Empty Local**: Local classes table has 0 records
3. **Data Quality**: Supabase has 26 "Unnamed" classes
4. **Sync Issue**: Current sync logic won't work due to schema differences

## 📋 Next Steps

1. **Schema Alignment**: Decide which schema to use
2. **Data Migration**: Map Supabase data to local schema
3. **Sync Logic**: Update sync functions for schema compatibility
4. **Data Cleanup**: Fix "Unnamed" classes in Supabase

## 🛠️ Quick Commands

```bash
# Check Supabase classes
python check_classes_cli.py

# Compare schemas
python schema_comparison.py

# Check local database
sqlite3 "C:\Users\Denis Kariuki\AppData\Roaming\shelf-serpent\library.db" ".schema classes"
```

---

**✅ Classes schema check completed successfully!**
**📊 All CLI tools are ready for use.**
