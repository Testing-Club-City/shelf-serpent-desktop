# 🔍 Group Borrowings Debug Analysis

## Issue Description
The system is showing only 2 group borrowing records when there should be more records in the database.

## 🛠️ Debugging Implementation Added

### 1. **Enhanced Console Logging**
Added comprehensive debugging in `Reports.tsx` to track:
- Online group borrowings data from Supabase
- Offline group borrowings data from local SQLite
- Final merged group borrowings data
- Direct database query results

### 2. **Debug Output Structure**
```javascript
console.log('=== GROUP BORROWINGS DEBUG ===');
console.log('Online group borrowings:', {
  defined: boolean,
  isArray: boolean,
  length: number,
  data: actual_data
});
console.log('Offline group borrowings:', {
  defined: boolean,
  isArray: boolean, 
  length: number,
  data: actual_data
});
console.log('Final group borrowings:', {
  length: number,
  data: actual_data
});
console.log('Direct database query result:', {
  length: number,
  data: actual_data
});
```

## 🔍 **Analysis Points to Check**

### 1. **Data Source Priority**
The system uses this fallback logic:
```typescript
const finalGroupBorrowings = React.useMemo(() => {
  const onlineData = Array.isArray(groupBorrowings) ? groupBorrowings : [];
  const offlineData = Array.isArray(offlineGroupBorrowings) ? offlineGroupBorrowings : [];
  
  if (onlineData.length > 0) {
    return onlineData;  // Prioritizes online data
  }
  return offlineData;   // Falls back to offline data
}, [groupBorrowings, offlineGroupBorrowings]);
```

### 2. **Potential Issues to Investigate**

#### **A. Database Query Issues**
- **SQLite Query**: Check if the `get_group_borrowings_with_details()` query is filtering out records
- **Deleted Records**: Query includes `WHERE (gb.deleted = 0 OR gb.deleted IS NULL)`
- **JOIN Issues**: LEFT JOIN with book_copies might be filtering records

#### **B. Data Synchronization Issues**
- **Supabase vs Local**: Online data might be limited while local has more
- **Sync Status**: Records might not be synced between online/offline databases
- **Connection State**: System might be using wrong data source

#### **C. React Query Caching**
- **Stale Data**: Query cache might be serving old data
- **Query Key Issues**: Different query keys might cause data inconsistency
- **Retry Logic**: Failed queries might return empty arrays

## 🔧 **Backend Query Analysis**

### Current SQLite Query:
```sql
SELECT 
    gb.id, gb.book_id, gb.book_copy_id, gb.tracking_code, gb.borrowed_date, gb.due_date, 
    gb.returned_date, gb.status, gb.notes, gb.issued_by, gb.returned_by, 
    gb.created_at, gb.updated_at, gb.student_ids, gb.condition_at_issue, 
    gb.condition_at_return, gb.return_notes, gb.fine_amount, gb.fine_paid, 
    gb.student_count,
    bc.title as book_title, bc.author as book_author, bc.isbn as book_isbn,
    bc.copy_identifier as copy_number, bc.condition as copy_condition_status
FROM group_borrowings gb
LEFT JOIN book_copies bc ON gb.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
WHERE (gb.deleted = 0 OR gb.deleted IS NULL)
ORDER BY gb.created_at DESC
```

### Potential Query Issues:
1. **LEFT JOIN Condition**: The JOIN includes deleted check which might filter records
2. **Missing Records**: Some group_borrowings might have invalid book_copy_id references
3. **Data Type Issues**: student_ids field might have parsing issues

## 📋 **Debugging Steps to Follow**

### 1. **Check Console Output**
When you run the app and go to Reports:
1. Open browser dev tools (F12)
2. Go to Console tab
3. Look for the debug output starting with `=== GROUP BORROWINGS DEBUG ===`
4. Compare the lengths and data between different sources

### 2. **Verify Database Content**
Check if the issue is in the database itself:
```sql
-- Count total group borrowings
SELECT COUNT(*) FROM group_borrowings WHERE (deleted = 0 OR deleted IS NULL);

-- Check for records without book_copy references
SELECT COUNT(*) FROM group_borrowings gb 
LEFT JOIN book_copies bc ON gb.book_copy_id = bc.id 
WHERE (gb.deleted = 0 OR gb.deleted IS NULL) AND bc.id IS NULL;

-- Check student_ids format
SELECT id, student_ids FROM group_borrowings LIMIT 10;
```

### 3. **Test Different Scenarios**
- **Online Mode**: Check if Supabase returns more records
- **Offline Mode**: Check if local SQLite has the missing records
- **Fresh Load**: Clear browser cache and reload
- **Direct Query**: Use the direct database query result from console

## 🎯 **Expected Debug Results**

### **If Issue is in Query:**
- Direct database query will show 2 records
- Both online and offline will show 2 records
- Issue is in the SQL query or database content

### **If Issue is in Data Source Priority:**
- Direct database query shows more records
- One source (online/offline) has more data than the other
- Final result is using the wrong source

### **If Issue is in React Query:**
- Direct database query shows more records
- Both hooks show fewer records
- Issue is in the React Query implementation

## 🔧 **Potential Fixes**

### 1. **Query Fix** (if SQL issue):
```sql
-- Remove JOIN condition that might filter records
SELECT gb.*, 
       bc.title as book_title, bc.author as book_author, bc.isbn as book_isbn
FROM group_borrowings gb
LEFT JOIN book_copies bc ON gb.book_copy_id = bc.id
WHERE (gb.deleted = 0 OR gb.deleted IS NULL)
ORDER BY gb.created_at DESC
```

### 2. **Data Source Fix** (if priority issue):
```typescript
// Combine both sources instead of prioritizing
const finalGroupBorrowings = React.useMemo(() => {
  const onlineData = Array.isArray(groupBorrowings) ? groupBorrowings : [];
  const offlineData = Array.isArray(offlineGroupBorrowings) ? offlineGroupBorrowings : [];
  
  // Merge and deduplicate by ID
  const combined = [...onlineData, ...offlineData];
  const unique = combined.filter((item, index, arr) => 
    arr.findIndex(i => i.id === item.id) === index
  );
  
  return unique;
}, [groupBorrowings, offlineGroupBorrowings]);
```

### 3. **Cache Fix** (if React Query issue):
```typescript
// Force fresh data
queryClient.invalidateQueries({ queryKey: ['groupBorrowings'] });
queryClient.invalidateQueries({ queryKey: ['group-borrowings', 'offline-first'] });
```

## 🚀 **Next Steps**

1. **Run the app** and check the console debug output
2. **Identify which scenario** matches your debug results
3. **Apply the appropriate fix** based on the root cause
4. **Test the fix** to ensure all records are displayed
5. **Remove debug logging** once issue is resolved

The enhanced debugging will help pinpoint exactly where the data is being lost in the chain from database → hooks → UI.