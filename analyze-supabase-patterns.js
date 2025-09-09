// Simplified analysis focusing on Supabase patterns only
const supabaseConfig = {
  url: "https://ddlzenlqkofefdwdefzm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
};

async function analyzeSupabaseBorrowingPatterns() {
  console.log('?? Analyzing Supabase borrowings patterns for sync validation...');
  
  try {
    // Get a sample of borrowings from Supabase
    console.log('\n?? SAMPLE BORROWINGS ANALYSIS:');
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=id,student_id,staff_id,book_id,book_copy_id,borrower_type&limit=20`,
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
    
    let validCount = 0;
    let invalidCount = 0;
    let invalidReasons = {};
    
    borrowings.forEach((borrowing, index) => {
      console.log(`\n  ${index + 1}. Borrowing ID: ${borrowing.id.substring(0, 8)}...`);
      console.log(`     Borrower Type: ${borrowing.borrower_type || 'NULL'}`);
      console.log(`     Student ID: ${borrowing.student_id || 'NULL'}`);
      console.log(`     Staff ID: ${borrowing.staff_id || 'NULL'}`);
      console.log(`     Book ID: ${borrowing.book_id ? borrowing.book_id.substring(0, 8) + '...' : 'NULL'}`);
      console.log(`     Book Copy ID: ${borrowing.book_copy_id ? borrowing.book_copy_id.substring(0, 8) + '...' : 'NULL'}`);
      
      // Simulate validation logic from Rust code
      const student_id = borrowing.student_id || "";
      const staff_id = borrowing.staff_id || "";
      const book_id = borrowing.book_id || "";
      const borrower_type = borrowing.borrower_type || "student";
      
      // Validation logic from Rust:
      // let has_valid_borrower = if borrower_type == "staff" {
      //     !staff_id.is_empty() && staff_ids.contains(staff_id)
      // } else {
      //     !student_id.is_empty() && student_ids.contains(student_id)
      // };
      
      let has_valid_borrower_ids = false;
      let has_valid_book_id = book_id !== "" && book_id !== null;
      let has_book_copy_id = borrowing.book_copy_id !== null && borrowing.book_copy_id !== "";
      
      let invalidReason = [];
      
      if (borrower_type === "staff") {
        has_valid_borrower_ids = staff_id !== "" && staff_id !== null;
        if (!has_valid_borrower_ids) invalidReason.push("missing_staff_id");
      } else {
        has_valid_borrower_ids = student_id !== "" && student_id !== null;
        if (!has_valid_borrower_ids) invalidReason.push("missing_student_id");
      }
      
      if (!has_valid_book_id) invalidReason.push("missing_book_id");
      if (!has_book_copy_id) invalidReason.push("missing_book_copy_id");
      
      const wouldPassBasicValidation = has_valid_borrower_ids && has_valid_book_id;
      
      console.log(`     Validation:`);
      console.log(`       - Valid borrower ID: ${has_valid_borrower_ids}`);
      console.log(`       - Valid book ID: ${has_valid_book_id}`);
      console.log(`       - Has book_copy_id: ${has_book_copy_id}`);
      console.log(`       - Basic validation: ${wouldPassBasicValidation ? '?' : '?'}`);
      
      if (wouldPassBasicValidation) {
        validCount++;
      } else {
        invalidCount++;
        invalidReason.forEach(reason => {
          invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
        });
      }
    });
    
    console.log(`\n?? SAMPLE VALIDATION SUMMARY:`);
    console.log(`  Valid (would sync): ${validCount}`);
    console.log(`  Invalid (would skip): ${invalidCount}`);
    console.log(`  Validation pass rate: ${((validCount / borrowings.length) * 100).toFixed(2)}%`);
    
    if (Object.keys(invalidReasons).length > 0) {
      console.log(`\n?? INVALID REASONS:`);
      Object.entries(invalidReasons).forEach(([reason, count]) => {
        console.log(`  ${reason}: ${count}`);
      });
    }
    
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
      const type = b.borrower_type || 'null/undefined';
      borrowerTypeCounts[type] = (borrowerTypeCounts[type] || 0) + 1;
    });
    
    Object.entries(borrowerTypeCounts).forEach(([type, count]) => {
      const percentage = ((count / borrowerData.length) * 100).toFixed(2);
      console.log(`  ${type}: ${count} (${percentage}%)`);
    });
    
    // Check for NULL patterns
    console.log('\n?? NULL ID PATTERNS:');
    
    // Check borrowings with NULL student_id
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
    
    const nullStudentHeader = nullStudentResponse.headers.get('content-range');
    const nullStudentCount = nullStudentHeader ? parseInt(nullStudentHeader.split('/')[1]) : 'unknown';
    
    // Check borrowings with NULL staff_id  
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
    
    const nullStaffHeader = nullStaffResponse.headers.get('content-range');
    const nullStaffCount = nullStaffHeader ? parseInt(nullStaffHeader.split('/')[1]) : 'unknown';
    
    console.log(`  Borrowings with NULL student_id: ${nullStudentCount}`);
    console.log(`  Borrowings with NULL staff_id: ${nullStaffCount}`);
    
    // Check specific problematic patterns
    console.log('\n?? PROBLEMATIC PATTERNS:');
    
    // Student borrowings with NULL student_id
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
    
    // Staff borrowings with NULL staff_id
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
    
    console.log(`  Student borrower_type with NULL student_id: ${problematicStudentCount}`);
    console.log(`  Staff borrower_type with NULL staff_id: ${problematicStaffCount}`);
    
    // Total borrowings count for context
    const totalResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const totalHeader = totalResponse.headers.get('content-range');
    const totalCount = totalHeader ? parseInt(totalHeader.split('/')[1]) : 'unknown';
    
    console.log('\n?? SYNC VALIDATION ANALYSIS:');
    console.log(`  Total borrowings: ${totalCount}`);
    console.log(`  Problematic student borrowings: ${problematicStudentCount}`);
    console.log(`  Problematic staff borrowings: ${problematicStaffCount}`);
    
    if (totalCount !== 'unknown') {
      const totalProblematic = problematicStudentCount + problematicStaffCount;
      const problemPercentage = ((totalProblematic / totalCount) * 100).toFixed(2);
      console.log(`  Total problematic: ${totalProblematic} (${problemPercentage}%)`);
      
      const wouldSync = totalCount - totalProblematic;
      const syncPercentage = ((wouldSync / totalCount) * 100).toFixed(2);
      console.log(`  Would sync successfully: ${wouldSync} (${syncPercentage}%)`);
      
      console.log('\n?? DIAGNOSIS:');
      if (totalProblematic > totalCount * 0.9) {
        console.log('  ? CRITICAL: Most borrowings have validation issues');
        console.log('  ?? The validation logic is rejecting almost everything');
        console.log('  ?? Need to fix validation or data structure');
      } else if (totalProblematic > totalCount * 0.5) {
        console.log('  ?? MAJOR: Many borrowings have validation issues');
        console.log('  ?? Significant data quality or validation logic problems');
      } else if (totalProblematic > 0) {
        console.log('  ?? MINOR: Some borrowings have validation issues');
        console.log('  ? Most should sync correctly');
      } else {
        console.log('  ? EXCELLENT: No major validation issues detected');
        console.log('  ?? Issue might be elsewhere (foreign key references?)');
      }
    }
    
  } catch (error) {
    console.error('? Error analyzing Supabase data:', error);
  }
}

// Run the analysis
analyzeSupabaseBorrowingPatterns();