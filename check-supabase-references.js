// Supabase-only version to check reference data
const supabaseConfig = {
  url: "https://ddlzenlqkofefdwdefzm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
};

async function checkSupabaseReferenceTables() {
  console.log('?? Checking Supabase reference tables for borrowings validation...');
  
  try {
    console.log('\n?? SUPABASE REFERENCE TABLE COUNTS:');
    console.log('=' * 60);
    
    // Get Supabase students count
    const studentsResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/students?select=count`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const studentsHeader = studentsResponse.headers.get('content-range');
    const supabaseStudentsCount = studentsHeader ? parseInt(studentsHeader.split('/')[1]) : 'unknown';
    
    // Get Supabase staff count
    const staffResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/staff?select=count`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const staffHeader = staffResponse.headers.get('content-range');
    const supabaseStaffCount = staffHeader ? parseInt(staffHeader.split('/')[1]) : 'unknown';
    
    // Get Supabase books count
    const booksResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/books?select=count`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const booksHeader = booksResponse.headers.get('content-range');
    const supabaseBooksCount = booksHeader ? parseInt(booksHeader.split('/')[1]) : 'unknown';
    
    console.log(`  Students: ${supabaseStudentsCount}`);
    console.log(`  Staff: ${supabaseStaffCount}`);
    console.log(`  Books: ${supabaseBooksCount}`);
    
    // Get sample borrowings to check which IDs they reference
    console.log('\n?? SAMPLE BORROWINGS REFERENCE ANALYSIS:');
    console.log('=' * 60);
    
    const borrowingsResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=id,student_id,staff_id,book_id,borrower_type&limit=20`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const borrowings = await borrowingsResponse.json();
    
    // Collect unique IDs referenced by borrowings
    const referencedStudentIds = new Set();
    const referencedStaffIds = new Set();
    const referencedBookIds = new Set();
    
    borrowings.forEach(borrowing => {
      if (borrowing.student_id) referencedStudentIds.add(borrowing.student_id);
      if (borrowing.staff_id) referencedStaffIds.add(borrowing.staff_id);
      if (borrowing.book_id) referencedBookIds.add(borrowing.book_id);
    });
    
    console.log(`Sample borrowings analyzed: ${borrowings.length}`);
    console.log(`Unique student IDs referenced: ${referencedStudentIds.size}`);
    console.log(`Unique staff IDs referenced: ${referencedStaffIds.size}`);
    console.log(`Unique book IDs referenced: ${referencedBookIds.size}`);
    
    // Check if these referenced IDs actually exist in their respective tables
    console.log('\n?? FOREIGN KEY VALIDATION TEST:');
    console.log('=' * 60);
    
    // Test a few student IDs
    if (referencedStudentIds.size > 0) {
      const sampleStudentIds = Array.from(referencedStudentIds).slice(0, 5);
      console.log('\nTesting student ID references:');
      
      for (const studentId of sampleStudentIds) {
        const checkResponse = await fetch(
          `${supabaseConfig.url}/rest/v1/students?select=id,first_name,last_name&id=eq.${studentId}`,
          {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const students = await checkResponse.json();
        const exists = students.length > 0;
        console.log(`  ${studentId.substring(0, 8)}... ${exists ? '? EXISTS' : '? MISSING'}`);
        if (exists) {
          console.log(`    Name: ${students[0].first_name} ${students[0].last_name}`);
        }
      }
    }
    
    // Test a few staff IDs
    if (referencedStaffIds.size > 0) {
      const sampleStaffIds = Array.from(referencedStaffIds).slice(0, 5);
      console.log('\nTesting staff ID references:');
      
      for (const staffId of sampleStaffIds) {
        const checkResponse = await fetch(
          `${supabaseConfig.url}/rest/v1/staff?select=id,first_name,last_name&id=eq.${staffId}`,
          {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const staff = await checkResponse.json();
        const exists = staff.length > 0;
        console.log(`  ${staffId.substring(0, 8)}... ${exists ? '? EXISTS' : '? MISSING'}`);
        if (exists) {
          console.log(`    Name: ${staff[0].first_name} ${staff[0].last_name}`);
        }
      }
    }
    
    // Test a few book IDs
    if (referencedBookIds.size > 0) {
      const sampleBookIds = Array.from(referencedBookIds).slice(0, 5);
      console.log('\nTesting book ID references:');
      
      for (const bookId of sampleBookIds) {
        const checkResponse = await fetch(
          `${supabaseConfig.url}/rest/v1/books?select=id,title,author&id=eq.${bookId}`,
          {
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const books = await checkResponse.json();
        const exists = books.length > 0;
        console.log(`  ${bookId.substring(0, 8)}... ${exists ? '? EXISTS' : '? MISSING'}`);
        if (exists) {
          console.log(`    Title: ${books[0].title} by ${books[0].author}`);
        }
      }
    }
    
    // Get comprehensive analysis of borrowing patterns
    console.log('\n?? BORROWING PATTERNS ANALYSIS:');
    console.log('=' * 60);
    
    // Check borrowings by type
    const studentBorrowingsResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&borrower_type=eq.student`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const staffBorrowingsResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&borrower_type=eq.staff`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const studentBorrowingsHeader = studentBorrowingsResponse.headers.get('content-range');
    const staffBorrowingsHeader = staffBorrowingsResponse.headers.get('content-range');
    
    const studentBorrowingsCount = studentBorrowingsHeader ? parseInt(studentBorrowingsHeader.split('/')[1]) : 'unknown';
    const staffBorrowingsCount = staffBorrowingsHeader ? parseInt(staffBorrowingsHeader.split('/')[1]) : 'unknown';
    
    console.log(`Student borrowings: ${studentBorrowingsCount}`);
    console.log(`Staff borrowings: ${staffBorrowingsCount}`);
    console.log(`Total borrowings: ${studentBorrowingsCount + staffBorrowingsCount}`);
    
    // Summary assessment
    console.log('\n?? REFERENCE VALIDATION ASSESSMENT:');
    console.log('=' * 60);
    
    const hasStudents = supabaseStudentsCount > 0;
    const hasStaff = supabaseStaffCount > 0;
    const hasBooks = supabaseBooksCount > 0;
    
    console.log(`Reference table availability:`);
    console.log(`  Students: ${hasStudents ? '?' : '?'} (${supabaseStudentsCount})`);
    console.log(`  Staff: ${hasStaff ? '?' : '?'} (${supabaseStaffCount})`);
    console.log(`  Books: ${hasBooks ? '?' : '?'} (${supabaseBooksCount})`);
    
    if (hasStudents && hasStaff && hasBooks) {
      console.log('\n? ALL REFERENCE TABLES EXIST IN SUPABASE');
      console.log('? The issue is likely with local database sync');
      console.log('?? RECOMMENDATION: Sync reference tables first, then borrowings');
    } else {
      console.log('\n? MISSING REFERENCE TABLES IN SUPABASE');
      console.log('?? RECOMMENDATION: Fix Supabase reference data first');
    }
    
    // Give specific sync recommendations
    console.log('\n?? SYNC SEQUENCE RECOMMENDATION:');
    console.log('1. ?? Sync books first (they have no dependencies)');
    console.log('2. ?? Sync students and staff (they depend on classes)');
    console.log('3. ?? Sync borrowings last (they depend on students, staff, and books)');
    console.log('4. ? This should fix the book_copy_id sync issue');
    
  } catch (error) {
    console.error('? Error checking Supabase data:', error);
  }
}

// Run the check
checkSupabaseReferenceTables();