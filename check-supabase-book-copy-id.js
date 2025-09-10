// Check Supabase borrowings for book_copy_id data using MCP server
const supabaseConfig = {
  url: "https://ddlzenlqkofefdwdefzm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
};

async function checkSupabaseBorrowingsBookCopyId() {
  console.log('?? Checking Supabase borrowings for book_copy_id data...');
  
  try {
    // Check total count of borrowings
    console.log('\n?? TOTAL BORROWINGS COUNT:');
    const countResponse = await fetch(
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
    
    const countHeader = countResponse.headers.get('content-range');
    const totalCount = countHeader ? parseInt(countHeader.split('/')[1]) : 'unknown';
    console.log(`  Total borrowings in Supabase: ${totalCount}`);
    
    // Check borrowings with book_copy_id NOT NULL
    console.log('\n?? BORROWINGS WITH BOOK_COPY_ID:');
    const withBookCopyIdResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&book_copy_id=not.is.null`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const withBookCopyIdHeader = withBookCopyIdResponse.headers.get('content-range');
    const withBookCopyIdCount = withBookCopyIdHeader ? parseInt(withBookCopyIdHeader.split('/')[1]) : 'unknown';
    console.log(`  Borrowings with book_copy_id (NOT NULL): ${withBookCopyIdCount}`);
    
    // Check borrowings with book_copy_id IS NULL
    console.log('\n?? BORROWINGS WITHOUT BOOK_COPY_ID:');
    const withoutBookCopyIdResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=count&book_copy_id=is.null`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const withoutBookCopyIdHeader = withoutBookCopyIdResponse.headers.get('content-range');
    const withoutBookCopyIdCount = withoutBookCopyIdHeader ? parseInt(withoutBookCopyIdHeader.split('/')[1]) : 'unknown';
    console.log(`  Borrowings with book_copy_id (IS NULL): ${withoutBookCopyIdCount}`);
    
    // Calculate percentages
    if (totalCount !== 'unknown' && withBookCopyIdCount !== 'unknown') {
      const percentage = ((withBookCopyIdCount / totalCount) * 100).toFixed(2);
      console.log(`  Percentage with book_copy_id: ${percentage}%`);
    }
    
    // Get sample borrowings with book_copy_id
    console.log('\n?? SAMPLE BORROWINGS WITH BOOK_COPY_ID:');
    const sampleResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=id,book_copy_id,book_id,borrower_type,status,borrowed_date&book_copy_id=not.is.null&limit=5`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const sampleData = await sampleResponse.json();
    sampleData.forEach((borrowing, index) => {
      console.log(`  ${index + 1}. Borrowing ID: ${borrowing.id}`);
      console.log(`     Book Copy ID: ${borrowing.book_copy_id}`);
      console.log(`     Book ID: ${borrowing.book_id}`);
      console.log(`     Borrower Type: ${borrowing.borrower_type}`);
      console.log(`     Status: ${borrowing.status}`);
      console.log(`     Date: ${borrowing.borrowed_date}`);
      console.log('');
    });
    
    // Get sample borrowings without book_copy_id
    console.log('\n?? SAMPLE BORROWINGS WITHOUT BOOK_COPY_ID:');
    const sampleNullResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=id,book_copy_id,book_id,borrower_type,status,borrowed_date&book_copy_id=is.null&limit=5`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const sampleNullData = await sampleNullResponse.json();
    sampleNullData.forEach((borrowing, index) => {
      console.log(`  ${index + 1}. Borrowing ID: ${borrowing.id}`);
      console.log(`     Book Copy ID: ${borrowing.book_copy_id || 'NULL'}`);
      console.log(`     Book ID: ${borrowing.book_id}`);
      console.log(`     Borrower Type: ${borrowing.borrower_type}`);
      console.log(`     Status: ${borrowing.status}`);
      console.log(`     Date: ${borrowing.borrowed_date}`);
      console.log('');
    });
    
    // Check if book_copy_id field exists by examining table structure
    console.log('\n?? TABLE STRUCTURE CHECK:');
    const structureResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/borrowings?select=*&limit=1`,
      {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const structureData = await structureResponse.json();
    if (structureData.length > 0) {
      const fields = Object.keys(structureData[0]);
      console.log(`  Available fields: ${fields.join(', ')}`);
      const hasBookCopyId = fields.includes('book_copy_id');
      console.log(`  Has book_copy_id column: ${hasBookCopyId ? '? YES' : '? NO'}`);
    }
    
    // Summary
    console.log('\n?? SUPABASE BOOK_COPY_ID ANALYSIS SUMMARY:');
    console.log('=' * 60);
    
    if (totalCount !== 'unknown' && withBookCopyIdCount !== 'unknown') {
      if (withBookCopyIdCount === totalCount) {
        console.log('  ?? PERFECT: All borrowings have book_copy_id!');
      } else if (withBookCopyIdCount > totalCount * 0.9) {
        console.log('  ? GOOD: Most borrowings have book_copy_id');
      } else if (withBookCopyIdCount > 0) {
        console.log('  ?? PARTIAL: Some borrowings have book_copy_id');
      } else {
        console.log('  ? ISSUE: No borrowings have book_copy_id');
      }
      
      console.log(`  Total: ${totalCount}`);
      console.log(`  With book_copy_id: ${withBookCopyIdCount}`);
      console.log(`  Without book_copy_id: ${withoutBookCopyIdCount}`);
      
      const percentage = ((withBookCopyIdCount / totalCount) * 100).toFixed(2);
      console.log(`  Coverage: ${percentage}%`);
    }
    
  } catch (error) {
    console.error('? Error checking Supabase borrowings:', error);
  }
}

// Run the check
checkSupabaseBorrowingsBookCopyId();