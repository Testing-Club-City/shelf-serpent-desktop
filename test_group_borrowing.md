# Group Borrowing Test Guide

## Issues Fixed

### 1. Parameter Name Mismatch
- **Problem**: `offlineDataService.createGroupBorrowing()` was calling Tauri command with `groupBorrowingData` parameter
- **Fix**: Changed to use `group_borrowing_data` to match the Tauri command parameter name

### 2. Database Schema Mismatch
- **Problem**: Group borrowing creation was trying to insert `student_ids` in a separate update query
- **Fix**: Modified to insert all fields including `student_ids` JSON in a single query

### 3. Search Command Issues
- **Problem**: Book copy search and student search had potential parameter mismatches
- **Fix**: Enhanced both search commands with better error handling and logging

## Test Steps

1. **Test Book Copy Search**:
   - Go to Borrowing Management → Groups tab
   - Click "New Group Borrowing"
   - Enter a valid legacy book ID (e.g., 5525, 41275, 41669)
   - Click "Search" - should find the book

2. **Test Student Search**:
   - In the same form, enter a valid admission number (e.g., 21479, 22354, 20867)
   - Should auto-search and find the student

3. **Test Group Borrowing Creation**:
   - Complete the form with:
     - Valid book (searched successfully)
     - At least one valid student (searched successfully)
     - Borrowed date (today)
     - Due date (auto-calculated)
     - Condition (good)
     - Optional notes
   - Click "Create Group Borrowing"
   - Should succeed without "Failed to create group borrowing" error

## Expected Results

- Book search should work and display book title/author
- Student search should work and display student name/class
- Form submission should succeed and show success toast
- Group borrowing should appear in the Groups tab

## Database Verification

You can verify the group borrowing was created by checking:
```sql
SELECT * FROM group_borrowings ORDER BY created_at DESC LIMIT 1;
```

The `student_ids` field should contain a JSON array like: `["uuid1", "uuid2"]`