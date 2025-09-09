# Database Update Instructions

## Summary

I've updated the schema mapper to match your new comprehensive Supabase schema. Here's what you need to do:

## ✅ **What's Been Updated**

1. **Schema Mapper Enhanced** - Updated all mapping functions to handle the new fields:
   - Enhanced borrowings with `book_copy_id`, `borrower_type`, `staff_id`, etc.
   - Added mappings for new tables: `staff`, `group_borrowings`, `theft_reports`, `notifications`, `profiles`
   - Proper enum handling for `book_status` and `borrowing_status`

2. **Compilation Fixed** - All Rust compilation errors resolved

## 🔧 **Required SQL Updates**

### **1. Local SQLite Database**
Run the SQL in `local_schema_updates.sql`:

```bash
# Option 1: Using sqlite3 command line
sqlite3 /home/deniskariuki/shelf-serpent-desktop/shelf-serpent.db < local_schema_updates.sql

# Option 2: Using your existing migration command (recommended)
# Start your Tauri app and run:
# run_database_migration()
```

### **2. Supabase Database**
Run the SQL in `supabase_schema_updates.sql` in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase_schema_updates.sql`
4. Execute the script

## 🚀 **Testing the Updated Sync**

After running the SQL updates, you can test the sync using your existing Tauri commands:

```javascript
// Test the migration first
await invoke('run_database_migration');

// Then test the improved bidirectional sync
await invoke('run_improved_bidirectional_sync');

// Or test the complete sync
await invoke('fixed_comprehensive_sync');
```

## 📊 **Key Improvements**

1. **Perfect Schema Alignment** - Local and Supabase schemas now match perfectly
2. **Enhanced Borrowings** - Full support for book copies, staff borrowers, and condition tracking
3. **New Tables Support** - Complete mapping for all new tables
4. **Better Error Handling** - Improved enum type handling and null value management
5. **Migration Safety** - All updates use `ALTER TABLE ADD COLUMN` with proper defaults

## 🔍 **Verification Steps**

1. Check that all tables have the 'synced' column
2. Verify new fields exist in borrowings table
3. Test that sync operations work without errors
4. Confirm data integrity after sync

## ⚠️ **Important Notes**

- The local schema updates are designed to be safe (won't lose data)
- All new columns have proper defaults
- The Supabase updates include performance optimizations
- Row Level Security policies are included for security

## 🆘 **If You Encounter Issues**

1. Check the Tauri console for detailed error messages
2. Verify your Supabase connection is working
3. Ensure all SQL scripts ran without errors
4. Test individual table syncs first before full sync

The schema mapper is now fully compatible with your comprehensive Supabase schema!
