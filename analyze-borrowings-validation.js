// Test what's actually happening in the borrowings sync validation
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const supabaseConfig = {
  url: "https://ddlzenlqkofefdwdefzm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
};

async function analyzeBorrowingsValidation() {
  console.log('?? Analyzing borrowings validation logic...');
  
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
    // Get local reference data counts
    console.log('\n?? LOCAL REFERENCE DATA:');
    const studentCount = db.prepare("SELECT COUNT(*) as count FROM students").get();
    const staffCount = db.prepare("SELECT COUNT(*) as count FROM staff").get();
    const bookCount = db.prepare("SELECT COUNT(*) as count FROM books").get();
    
    console.log(`  Students: ${studentCount.count}`);
    console.log(`  Staff: ${staffCount.count}`);
    console.log(`  Books: ${bookCount.count}`);
    
    // Get sample IDs
    const sampleStudents = db.prepare("SELECT id FROM students LIMIT 5").all();
    const sampleStaff = db.prepare("SELECT id FROM staff LIMIT 5").all();
    const sampleBooks = db.prepare("SELECT id FROM books LIMIT 5").all();
    
    console.log('\n?? SAMPLE LOCAL IDs:');
    console.log('  Student IDs:', sampleStudents.map(s => s.id.substring(0, 8) + '...'));
    console.log('  Staff IDs:', sampleStaff.map(s => s.id.substring(0, 8) + '...'));
    console.log('  Book IDs:', sampleBooks.map(b => b.id.substring(0, 8) + '...'));
    
  } catch (error) {
    console.error('? Error reading local data:', error);
    return;
  } finally {
    if (db) {
      db.close();
    }
  }

  // Now check Supabase borrowings validation
  try {
    console.log('\n?? SUPABASE BORROWINGS VALIDATION TEST:');
    
    // Get a sample of borrowings from Supabase
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=id,student_id,staff_id,book_id,book_copy_id,borrower_type&limit=10`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const borrowings = await response.json();
    
    console.log(`\n?? ANALYZING ${borrowings.length} SAMPLE BORROWINGS:`);
    
    borrowings.forEach((borrowing, index) => {
      console.log(`\n  ${index + 1}. Borrowing ID: ${borrowing.id.substring(0, 8)}...`);
      console.log(`     Borrower Type: ${borrowing.borrower_type}`);
      console.log(`     Student ID: ${borrowing.student_id || 'NULL'}`);
      console.log(`     Staff ID: ${borrowing.staff_id || 'NULL'}`);
      console.log(`     Book ID: ${borrowing.book_id ? borrowing.book_id.substring(0, 8) + '...' : 'NULL'}`);
      console.log(`     Book Copy ID: ${borrowing.book_copy_id ? borrowing.book_copy_id.substring(0, 8) + '...' : 'NULL'}`);
      
      // Simulate validation logic
      const student_id = borrowing.student_id || "";
      const staff_id = borrowing.staff_id || "";
      const book_id = borrowing.book_id || "";
      const borrower_type = borrowing.borrower_type || "student";
      
      // Check if this would pass validation
      const has_valid_borrower = borrower_type === "staff" ? 
        (!staff_id === "" && staff_id !== null) : 
        (!student_id === "" && student_id !== null);
      
      const has_valid_book = book_id !== "" && book_id !== null;
      const has_book_copy_id = borrowing.book_copy_id !== null && borrowing.book_copy_id !== "";
      
      console.log(`     Validation:`);
      console.log(`       - Valid borrower: ${has_valid_borrower}`);
      console.log(`       - Valid book: ${has_valid_book}`);
      console.log(`       - Has book_copy_id: ${has_book_copy_id}`);
      console.log(`       - Would sync: ${has_valid_borrower && has_valid_book ? '?' : '?'}`);
    });
    
    // Check borrower type distribution
    console.log('\n?? BORROWER TYPE DISTRIBUTION:');
    const borrowerTypeResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=borrower_type&limit=1000`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const borrowerData = await borrowerTypeResponse.json();
    const borrowerTypeCounts = {};
    borrowerData.forEach(b => {
      const type = b.borrower_type || 'undefined';
      borrowerTypeCounts[type] = (borrowerTypeCounts[type] || 0) + 1;
    });
    
    Object.entries(borrowerTypeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Check for NULL student_id vs staff_id patterns
    console.log('\n?? NULL ID PATTERNS:');
    const nullStudentResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&student_id=is.null`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const nullStaffResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&staff_id=is.null`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const nullStudentHeader = nullStudentResponse.headers.get('content-range');
    const nullStaffHeader = nullStaffResponse.headers.get('content-range');
    
    const nullStudentCount = nullStudentHeader ? parseInt(nullStudentHeader.split('/')[1]) : 'unknown';
    const nullStaffCount = nullStaffHeader ? parseInt(nullStaffHeader.split('/')[1]) : 'unknown';
    
    console.log(`  Borrowings with NULL student_id: ${nullStudentCount}`);
    console.log(`  Borrowings with NULL staff_id: ${nullStaffCount}`);
    
    // Check specific patterns
    console.log('\n?? PROBLEMATIC PATTERNS:');
    
    // Check borrowings with borrower_type=student but NULL student_id
    const problematicStudentResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&borrower_type=eq.student&student_id=is.null`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const problematicStudentHeader = problematicStudentResponse.headers.get('content-range');
    const problematicStudentCount = problematicStudentHeader ? parseInt(problematicStudentHeader.split('/')[1]) : 'unknown';
    
    console.log(`  Student borrowings with NULL student_id: ${problematicStudentCount}`);
    
    // Check borrowings with borrower_type=staff but NULL staff_id
    const problematicStaffResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&borrower_type=eq.staff&staff_id=is.null`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const problematicStaffHeader = problematicStaffResponse.headers.get('content-range');
    const problematicStaffCount = problematicStaffHeader ? parseInt(problematicStaffHeader.split('/')[1]) : 'unknown';
    
    console.log(`  Staff borrowings with NULL staff_id: ${problematicStaffCount}`);
    
    console.log('\n?? LIKELY SYNC ISSUE:');
    if (problematicStudentCount > 0 || problematicStaffCount > 0) {
      console.log('  ? Many borrowings have mismatched borrower_type and NULL IDs');
      console.log('  ?? This would cause them to be rejected by validation');
      console.log('  ?? The sync validation logic is too strict');
    } else {
      console.log('  ? ID patterns look correct');
      console.log('  ?? Issue might be with foreign key references');
    }
    
  } catch (error) {
    console.error('? Error analyzing Supabase data:', error);
  }
}

// Run the analysis
analyzeBorrowingsValidation();