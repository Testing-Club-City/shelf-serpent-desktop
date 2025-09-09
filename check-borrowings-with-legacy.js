import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBorrowingsWithLegacyBookIds() {
  try {
    console.log('?? Checking borrowings linked with legacy book IDs...');
    
    // Get borrowings with book copy information including legacy book IDs
    const { data: borrowingsWithLegacy, error: borrowingsError } = await supabase
      .from('borrowings')
      .select(`
        id,
        borrower_type,
        status,
        borrowed_date,
        due_date,
        returned_date,
        fine_amount,
        staff_id,
        student_id,
        book_copies!inner (
          id,
          legacy_book_id,
          book_code,
          tracking_code,
          books (
            id,
            title,
            author,
            isbn,
            legacy_book_id,
            legacy_isbn
          )
        )
      `)
      .limit(50); // Limit for initial analysis

    if (borrowingsError) {
      console.error('? Error fetching borrowings with legacy data:', borrowingsError);
      return;
    }

    console.log(`?? Found ${borrowingsWithLegacy.length} borrowings with legacy book information`);

    // Analyze the data
    let staffBorrowings = 0;
    let studentBorrowings = 0;
    let activeBorrowings = 0;
    let returnedBorrowings = 0;
    let borrowingsWithLegacyBookId = 0;

    console.log('\n?? Sample borrowings with legacy book IDs:');
    console.log('=' * 80);

    borrowingsWithLegacy.forEach((borrowing, index) => {
      // Count statistics
      if (borrowing.borrower_type === 'staff') staffBorrowings++;
      if (borrowing.borrower_type === 'student') studentBorrowings++;
      if (borrowing.status === 'active') activeBorrowings++;
      if (borrowing.status === 'returned') returnedBorrowings++;
      if (borrowing.book_copies.legacy_book_id) borrowingsWithLegacyBookId++;

      // Show first 10 detailed records
      if (index < 10) {
        console.log(`\n${index + 1}. Borrowing Record:`);
        console.log(`   Borrowing ID: ${borrowing.id}`);
        console.log(`   Borrower Type: ${borrowing.borrower_type}`);
        console.log(`   Status: ${borrowing.status}`);
        console.log(`   Borrowed Date: ${borrowing.borrowed_date}`);
        console.log(`   Due Date: ${borrowing.due_date}`);
        
        if (borrowing.returned_date) {
          console.log(`   Returned Date: ${borrowing.returned_date}`);
        }
        
        if (borrowing.fine_amount) {
          console.log(`   Fine Amount: ${borrowing.fine_amount}`);
        }

        // Book copy information
        console.log(`   ?? Book Copy Info:`);
        console.log(`      Copy ID: ${borrowing.book_copies.id}`);
        console.log(`      Legacy Book ID: ${borrowing.book_copies.legacy_book_id || 'None'}`);
        console.log(`      Book Code: ${borrowing.book_copies.book_code || 'None'}`);
        console.log(`      Tracking Code: ${borrowing.book_copies.tracking_code || 'None'}`);

        // Book information
        if (borrowing.book_copies.books) {
          console.log(`   ?? Book Info:`);
          console.log(`      Book ID: ${borrowing.book_copies.books.id}`);
          console.log(`      Title: ${borrowing.book_copies.books.title}`);
          console.log(`      Author: ${borrowing.book_copies.books.author || 'Unknown'}`);
          console.log(`      ISBN: ${borrowing.book_copies.books.isbn || 'None'}`);
          console.log(`      Legacy Book ID: ${borrowing.book_copies.books.legacy_book_id || 'None'}`);
          console.log(`      Legacy ISBN: ${borrowing.book_copies.books.legacy_isbn || 'None'}`);
        }
      }
    });

    // Get total counts for better analysis
    console.log('\n?? Getting total counts...');
    
    const { count: totalBorrowings } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true });

    const { count: totalStaffBorrowings } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'staff');

    const { count: totalStudentBorrowings } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'student');

    // Check how many book copies have legacy book IDs
    const { count: copiesWithLegacyIds } = await supabase
      .from('book_copies')
      .select('*', { count: 'exact', head: true })
      .not('legacy_book_id', 'is', null);

    const { count: totalBookCopies } = await supabase
      .from('book_copies')
      .select('*', { count: 'exact', head: true });

    // Summary
    console.log('\n?? COMPREHENSIVE ANALYSIS:');
    console.log('=' * 50);
    console.log(`Total Borrowings in Database: ${totalBorrowings}`);
    console.log(`Total Staff Borrowings: ${totalStaffBorrowings}`);
    console.log(`Total Student Borrowings: ${totalStudentBorrowings}`);
    console.log('\nBook Copy Legacy Data:');
    console.log(`Total Book Copies: ${totalBookCopies}`);
    console.log(`Book Copies with Legacy Book IDs: ${copiesWithLegacyIds}`);
    console.log(`Percentage with Legacy IDs: ${((copiesWithLegacyIds / totalBookCopies) * 100).toFixed(2)}%`);
    
    console.log('\nSample Analysis (from first 50 records):');
    console.log(`Staff Borrowings: ${staffBorrowings}`);
    console.log(`Student Borrowings: ${studentBorrowings}`);
    console.log(`Active Borrowings: ${activeBorrowings}`);
    console.log(`Returned Borrowings: ${returnedBorrowings}`);
    console.log(`Borrowings with Legacy Book IDs: ${borrowingsWithLegacyBookId}`);

    // Check for borrowings that might be missing legacy book ID connections
    console.log('\n?? Checking for borrowings without legacy book ID connections...');
    
    const { data: borrowingsWithoutLegacy, error: noLegacyError } = await supabase
      .from('borrowings')
      .select(`
        id,
        borrower_type,
        book_copies!inner (
          id,
          legacy_book_id
        )
      `)
      .is('book_copies.legacy_book_id', null)
      .limit(10);

    if (noLegacyError) {
      console.error('? Error checking borrowings without legacy IDs:', noLegacyError);
    } else {
      console.log(`??  Found ${borrowingsWithoutLegacy.length} borrowings (sample) without legacy book IDs`);
    }
    
  } catch (error) {
    console.error('? Unexpected error:', error);
  }
}

// Run the analysis
checkBorrowingsWithLegacyBookIds();