import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStaffBorrowings() {
  try {
    console.log('?? Checking staff borrowings in the database...');
    
    // Get total staff borrowings
    const { data: allStaffBorrowings, error: allError, count: totalCount } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact' })
      .eq('borrower_type', 'staff');
    
    if (allError) {
      console.error('? Error fetching staff borrowings:', allError);
      return;
    }
    
    console.log(`?? Total staff borrowings: ${totalCount}`);
    
    // Get active staff borrowings
    const { data: activeStaffBorrowings, error: activeError, count: activeCount } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact' })
      .eq('borrower_type', 'staff')
      .eq('status', 'active');
    
    if (activeError) {
      console.error('? Error fetching active staff borrowings:', activeError);
      return;
    }
    
    console.log(`?? Active staff borrowings: ${activeCount}`);
    
    // Get returned staff borrowings
    const { data: returnedStaffBorrowings, error: returnedError, count: returnedCount } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact' })
      .eq('borrower_type', 'staff')
      .eq('status', 'returned');
    
    if (returnedError) {
      console.error('? Error fetching returned staff borrowings:', returnedError);
      return;
    }
    
    console.log(`?? Returned staff borrowings: ${returnedCount}`);
    
    // Show some sample staff borrowings
    console.log('\n?? Sample staff borrowings:');
    if (allStaffBorrowings && allStaffBorrowings.length > 0) {
      allStaffBorrowings.slice(0, 5).forEach((borrowing, index) => {
        console.log(`\n${index + 1}. Staff Borrowing:`);
        console.log(`   ID: ${borrowing.id}`);
        console.log(`   Staff ID: ${borrowing.staff_id}`);
        console.log(`   Book ID: ${borrowing.book_id}`);
        console.log(`   Status: ${borrowing.status}`);
        console.log(`   Borrowed Date: ${borrowing.borrowed_date}`);
        console.log(`   Due Date: ${borrowing.due_date}`);
        if (borrowing.returned_date) {
          console.log(`   Returned Date: ${borrowing.returned_date}`);
        }
        if (borrowing.fine_amount) {
          console.log(`   Fine Amount: ${borrowing.fine_amount}`);
        }
      });
    }
    
    // Summary
    console.log('\n?? SUMMARY:');
    console.log(`Total Staff Borrowings: ${totalCount}`);
    console.log(`Active: ${activeCount}`);
    console.log(`Returned: ${returnedCount}`);
    
  } catch (error) {
    console.error('? Unexpected error:', error);
  }
}

// Run the check
checkStaffBorrowings();