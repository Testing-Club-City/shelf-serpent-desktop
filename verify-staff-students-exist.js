import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const supabaseConfig = {
  url: "https://ddlzenlqkofefdwdefzm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
};

async function verifyStaffAndStudentsExist() {
  console.log('?? Verifying staff and students in local vs Supabase...');
  
  // Connect to local database
  const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
  let db;
  
  try {
    db = new Database(localDbPath, { readonly: true });
    console.log('? Connected to local database');
  } catch (error) {
    console.error('? Could not connect to local database:', error);
    return;
  }

  try {
    console.log('\n?? LOCAL DATABASE COUNTS:');
    console.log('=' * 60);
    
    // Get local counts
    const localStudents = db.prepare("SELECT COUNT(*) as count FROM students").get();
    const localStaff = db.prepare("SELECT COUNT(*) as count FROM staff").get();
    const localBooks = db.prepare("SELECT COUNT(*) as count FROM books").get();
    
    console.log(`  Students: ${localStudents.count}`);
    console.log(`  Staff: ${localStaff.count}`);
    console.log(`  Books: ${localBooks.count}`);
    
    // Get sample IDs
    const sampleStudents = db.prepare("SELECT id, first_name, last_name, admission_number FROM students LIMIT 5").all();
    const sampleStaff = db.prepare("SELECT id, first_name, last_name, staff_id FROM staff LIMIT 5").all();
    const sampleBooks = db.prepare("SELECT id, title, author FROM books LIMIT 5").all();
    
    console.log('\n?? SAMPLE LOCAL RECORDS:');
    console.log('Students:');
    sampleStudents.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.admission_number})`);
      console.log(`     ID: ${student.id}`);
    });
    
    console.log('\nStaff:');
    sampleStaff.forEach((staff, index) => {
      console.log(`  ${index + 1}. ${staff.first_name} ${staff.last_name} (${staff.staff_id || 'No Staff ID'})`);
      console.log(`     ID: ${staff.id}`);
    });
    
    console.log('\nBooks:');
    sampleBooks.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} by ${book.author}`);
      console.log(`     ID: ${book.id}`);
    });
    
  } catch (error) {
    console.error('? Error reading local data:', error);
    return;
  } finally {
    if (db) {
      db.close();
    }
  }

  // Now check Supabase counts
  try {
    console.log('\n?? SUPABASE DATABASE COUNTS:');
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
    
    // Get sample Supabase records
    console.log('\n?? SAMPLE SUPABASE RECORDS:');
    
    // Sample students
    const sampleStudentsResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/students?select=id,first_name,last_name,admission_number&limit=5`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const supabaseStudentsSample = await sampleStudentsResponse.json();
    console.log('Students:');
    supabaseStudentsSample.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.admission_number})`);
      console.log(`     ID: ${student.id}`);
    });
    
    // Sample staff
    const sampleStaffResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/staff?select=id,first_name,last_name,staff_id&limit=5`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const supabaseStaffSample = await sampleStaffResponse.json();
    console.log('\nStaff:');
    supabaseStaffSample.forEach((staff, index) => {
      console.log(`  ${index + 1}. ${staff.first_name} ${staff.last_name} (${staff.staff_id || 'No Staff ID'})`);
      console.log(`     ID: ${staff.id}`);
    });
    
    // Sample books
    const sampleBooksResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/books?select=id,title,author&limit=5`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const supabaseBooksSample = await sampleBooksResponse.json();
    console.log('\nBooks:');
    supabaseBooksSample.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} by ${book.author}`);
      console.log(`     ID: ${book.id}`);
    });
    
    // Compare counts
    console.log('\n?? COMPARISON ANALYSIS:');
    console.log('=' * 60);
    
    const studentMatch = localStudents.count === supabaseStudentsCount;
    const staffMatch = localStaff.count === supabaseStaffCount;
    const bookMatch = localBooks.count === supabaseBooksCount;
    
    console.log(`Students: Local ${localStudents.count} vs Supabase ${supabaseStudentsCount} ${studentMatch ? '?' : '?'}`);
    console.log(`Staff: Local ${localStaff.count} vs Supabase ${supabaseStaffCount} ${staffMatch ? '?' : '?'}`);
    console.log(`Books: Local ${localBooks.count} vs Supabase ${supabaseBooksCount} ${bookMatch ? '?' : '?'}`);
    
    // Calculate differences
    const studentDiff = Math.abs(localStudents.count - supabaseStudentsCount);
    const staffDiff = Math.abs(localStaff.count - supabaseStaffCount);
    const bookDiff = Math.abs(localBooks.count - supabaseBooksCount);
    
    console.log('\n?? DIFFERENCES:');
    console.log(`Students difference: ${studentDiff}`);
    console.log(`Staff difference: ${staffDiff}`);
    console.log(`Books difference: ${bookDiff}`);
    
    // Assess sync status
    console.log('\n?? SYNC STATUS ASSESSMENT:');
    console.log('=' * 60);
    
    if (studentMatch && staffMatch && bookMatch) {
      console.log('? PERFECT: All reference tables are perfectly synced!');
      console.log('? Foreign key validation should work correctly.');
      console.log('? The borrowings sync issue is not due to missing references.');
    } else {
      console.log('? SYNC ISSUES DETECTED:');
      
      if (!studentMatch) {
        console.log(`  ? Students: Missing ${studentDiff} records`);
        console.log('  ?? Need to run students sync');
      }
      
      if (!staffMatch) {
        console.log(`  ? Staff: Missing ${staffDiff} records`);
        console.log('  ?? Need to run staff sync');
      }
      
      if (!bookMatch) {
        console.log(`  ? Books: Missing ${bookDiff} records`);
        console.log('  ?? Need to run books sync');
      }
      
      console.log('\n?? RECOMMENDED ACTIONS:');
      console.log('1. ?? Sync missing reference tables first');
      console.log('2. ?? Then run the borrowings sync');
      console.log('3. ? This should fix the book_copy_id sync issue');
    }
    
    // Check for ID mismatches
    console.log('\n?? ID COMPATIBILITY CHECK:');
    
    // Check if any Supabase IDs exist in local database
    if (supabaseStudentsSample.length > 0 && sampleStudents.length > 0) {
      const localStudentIds = new Set(sampleStudents.map(s => s.id));
      const supabaseStudentIds = supabaseStudentsSample.map(s => s.id);
      const matchingStudentIds = supabaseStudentIds.filter(id => localStudentIds.has(id));
      
      console.log(`Sample student ID matches: ${matchingStudentIds.length}/${supabaseStudentIds.length}`);
      
      if (matchingStudentIds.length === 0) {
        console.log('?? WARNING: No matching student IDs found in samples');
        console.log('?? This suggests ID structure mismatch between local and remote');
      }
    }
    
    if (supabaseStaffSample.length > 0 && sampleStaff.length > 0) {
      const localStaffIds = new Set(sampleStaff.map(s => s.id));
      const supabaseStaffIds = supabaseStaffSample.map(s => s.id);
      const matchingStaffIds = supabaseStaffIds.filter(id => localStaffIds.has(id));
      
      console.log(`Sample staff ID matches: ${matchingStaffIds.length}/${supabaseStaffIds.length}`);
      
      if (matchingStaffIds.length === 0) {
        console.log('?? WARNING: No matching staff IDs found in samples');
        console.log('?? This suggests ID structure mismatch between local and remote');
      }
    }
    
  } catch (error) {
    console.error('? Error checking Supabase data:', error);
  }
}

// Run the verification
verifyStaffAndStudentsExist();