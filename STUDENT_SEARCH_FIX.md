## Student Search Fix for Borrowing Management

**ISSUE IDENTIFIED**: Your borrowing management page is not searching students in the local database.

### **Root Cause**
In your `NewBorrowingForm.tsx`, the student search directly queries Supabase instead of using the offline-first local database:

```typescript
// ? PROBLEM: Direct Supabase query (current code)
const { data, error } = await supabase
  .from('students')
  .select('id, first_name, last_name, admission_number, class_grade')
  .or(`admission_number.ilike.%${debouncedSearchQuery}%,first_name.ilike.%${debouncedSearchQuery}%,last_name.ilike.%${debouncedSearchQuery}%`)
  .eq('status', 'active')
  .order('admission_number')
  .limit(20);
```

### **Solution Applied**
The fix is to use offline-first hooks that prioritize local SQLite database:

```typescript
// ? SOLUTION: Use offline-first hooks
const { data: studentsData } = useStudentsOffline();
const { data: staffData } = useStaffOffline();

// Then search locally first:
if (studentsData && studentsData.length > 0) {
  console.log(`?? Searching ${studentsData.length} students from LOCAL database`);
  
  const query = debouncedSearchQuery.toLowerCase();
  const filteredStudents = studentsData.filter((student: any) => {
    const isActive = !student.status || student.status === 'active';
    const matchesSearch = 
      student.admission_number?.toLowerCase().includes(query) ||
      student.first_name?.toLowerCase().includes(query) ||
      student.last_name?.toLowerCase().includes(query);
    return isActive && matchesSearch;
  }).slice(0, 20);
  
  setSearchResults(filteredStudents);
} else {
  // Fallback to Supabase only if no local data
  console.log('?? No local student data available, falling back to Supabase');
  // ... existing Supabase code
}
```

### **Key Changes Made**
1. **Added offline-first imports**:
   - `useStudentsOffline` for local student data
   - `useStaffOffline` for local staff data

2. **Modified search logic**:
   - Check local data first (`studentsData.length > 0`)
   - Filter locally using JavaScript array methods
   - Only fallback to Supabase if no local data exists

3. **Enhanced logging**:
   - Clear console messages showing data source
   - Emojis for easy identification: ?? (local search), ?? (remote fallback)

### **Expected Results**
After this fix:
- ? Students will be found from local database when searching
- ? Search will be faster (no network latency)
- ? Search will work offline
- ? Automatic fallback to Supabase if local database is empty

### **Testing Steps**
1. Make sure you have student data synced locally
2. Search for a student by admission number or name
3. Check browser console for logging messages
4. Should see: `?? Searching X students from LOCAL database`
5. Should see: `? Found X matching students from LOCAL database`

### **Troubleshooting**
If students are still not found:

1. **Check local data sync**:
   ```bash
   # Check if students are in local database
   Open browser console in your app and run:
   ```
   
2. **Verify student data structure**:
   - Ensure `admission_number`, `first_name`, `last_name` fields exist
   - Verify `status` field is 'active' or undefined

3. **Force data sync**:
   - Use the sync functionality to pull student data to local database
   - Check that `get_students` command in Rust is working

The offline-first approach ensures reliable student search regardless of internet connectivity!