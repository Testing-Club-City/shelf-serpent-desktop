import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function analyzeSupabaseSchema() {
  console.log('?? Analyzing Supabase borrowings schema and data structure...');
  
  try {
    // 1. Get raw borrowings data with all fields (like the app does)
    console.log('\n1?? CHECKING RAW BORROWINGS DATA STRUCTURE:');
    console.log('=' * 60);
    
    const { data: rawBorrowings, error: rawError } = await supabase
      .from('borrowings')
      .select('*')
      .limit(5);

    if (rawError) {
      console.error('? Error fetching raw borrowings:', rawError);
      return;
    }

    if (rawBorrowings && rawBorrowings.length > 0) {
      console.log('Sample raw borrowing record:');
      console.log(JSON.stringify(rawBorrowings[0], null, 2));
      
      console.log('\nAll available fields in borrowings table:');
      const fields = Object.keys(rawBorrowings[0]);
      fields.forEach(field => {
        console.log(`  - ${field}: ${typeof rawBorrowings[0][field]} = ${rawBorrowings[0][field]}`);
      });
    }

    // 2. Check the exact query that the app uses for borrowings with relationships
    console.log('\n2?? CHECKING APP-STYLE QUERY WITH RELATIONSHIPS:');
    console.log('=' * 60);
    
    const { data: appStyleBorrowings, error: appError } = await supabase
      .from('borrowings')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name,
          admission_number,
          class_grade
        ),
        staff (
          id,
          first_name,
          last_name,
          staff_id,
          department,
          position
        ),
        books (
          id,
          title,
          author,
          book_code
        ),
        book_copies (
          id,
          copy_number,
          tracking_code,
          condition,
          status,
          legacy_book_id
        )
      `)
      .limit(5);

    if (appError) {
      console.error('? Error with app-style query:', appError);
    } else if (appStyleBorrowings && appStyleBorrowings.length > 0) {
      console.log('Sample app-style borrowing with relationships:');
      console.log(JSON.stringify(appStyleBorrowings[0], null, 2));
    }

    // 3. Check specifically for staff borrowings with relationships
    console.log('\n3?? CHECKING STAFF BORROWINGS WITH RELATIONSHIPS:');
    console.log('=' * 60);
    
    const { data: staffBorrowings, error: staffError } = await supabase
      .from('borrowings')
      .select(`
        *,
        staff!inner (
          id,
          first_name,
          last_name,
          staff_id,
          department,
          position
        ),
        books (
          id,
          title,
          author,
          book_code
        ),
        book_copies (
          id,
          copy_number,
          tracking_code,
          condition,
          status,
          legacy_book_id
        )
      `)
      .eq('borrower_type', 'staff')
      .eq('status', 'active')
      .limit(3);

    if (staffError) {
      console.error('? Error fetching staff borrowings:', staffError);
    } else {
      console.log(`Found ${staffBorrowings?.length || 0} staff borrowings with relationships`);
      if (staffBorrowings && staffBorrowings.length > 0) {
        console.log('Sample staff borrowing with full relationships:');
        console.log(JSON.stringify(staffBorrowings[0], null, 2));
      }
    }

    // 4. Check book_copies relationship specifically
    console.log('\n4?? CHECKING BOOK_COPIES RELATIONSHIP:');
    console.log('=' * 60);
    
    const { data: borrowingsWithCopies, error: copiesError } = await supabase
      .from('borrowings')
      .select(`
        id,
        borrower_type,
        book_copy_id,
        book_copies!inner (
          id,
          legacy_book_id,
          copy_number,
          tracking_code,
          book_id,
          books (
            title,
            author
          )
        )
      `)
      .not('book_copies.legacy_book_id', 'is', null)
      .limit(5);

    if (copiesError) {
      console.error('? Error fetching borrowings with book copies:', copiesError);
    } else {
      console.log(`Found ${borrowingsWithCopies?.length || 0} borrowings with legacy book IDs`);
      if (borrowingsWithCopies && borrowingsWithCopies.length > 0) {
        borrowingsWithCopies.forEach((borrowing, index) => {
          console.log(`  ${index + 1}. Borrowing ${borrowing.id} (${borrowing.borrower_type})`);
          console.log(`     Book: ${borrowing.book_copies.books?.title}`);
          console.log(`     Legacy ID: ${borrowing.book_copies.legacy_book_id}`);
          console.log(`     Copy ID: ${borrowing.book_copy_id}`);
        });
      }
    }

    // 5. Check how many borrowings have book_copy_id vs don't
    console.log('\n5?? CHECKING BOOK_COPY_ID DISTRIBUTION:');
    console.log('=' * 60);
    
    const { count: withCopyId, error: withCopyError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .not('book_copy_id', 'is', null);

    const { count: withoutCopyId, error: withoutCopyError } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .is('book_copy_id', null);

    if (!withCopyError && !withoutCopyError) {
      console.log(`Borrowings WITH book_copy_id: ${withCopyId}`);
      console.log(`Borrowings WITHOUT book_copy_id: ${withoutCopyId}`);
      const total = withCopyId + withoutCopyId;
      console.log(`Percentage with book_copy_id: ${((withCopyId / total) * 100).toFixed(2)}%`);
    }

    // 6. Check the sync process - how data might be getting corrupted
    console.log('\n6?? CHECKING DATA SYNC PATTERNS:');
    console.log('=' * 60);
    
    // Check for borrowings created recently that might show sync patterns
    const { data: recentBorrowings, error: recentError } = await supabase
      .from('borrowings')
      .select(`
        id,
        borrower_type,
        staff_id,
        student_id,
        book_copy_id,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentError && recentBorrowings) {
      console.log('Recent borrowings pattern:');
      recentBorrowings.forEach((borrowing, index) => {
        console.log(`  ${index + 1}. ${borrowing.borrower_type} borrowing (${borrowing.created_at})`);
        console.log(`     Staff ID: ${borrowing.staff_id || 'null'}`);
        console.log(`     Student ID: ${borrowing.student_id || 'null'}`);
        console.log(`     Book Copy ID: ${borrowing.book_copy_id || 'null'}`);
      });
    }

    // 7. Check borrower_type vs actual ID pattern
    console.log('\n7?? CHECKING BORROWER_TYPE VS ID CONSISTENCY:');
    console.log('=' * 60);
    
    const { count: staffTypeWithStaffId, error: error1 } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'staff')
      .not('staff_id', 'is', null);

    const { count: staffTypeWithStudentId, error: error2 } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'staff')
      .not('student_id', 'is', null);

    const { count: studentTypeWithStaffId, error: error3 } = await supabase
      .from('borrowings')
      .select('*', { count: 'exact', head: true })
      .eq('borrower_type', 'student')
      .not('staff_id', 'is', null);

    if (!error1 && !error2 && !error3) {
      console.log('Data consistency check:');
      console.log(`  Staff borrower_type WITH staff_id: ${staffTypeWithStaffId} ?`);
      console.log(`  Staff borrower_type WITH student_id: ${staffTypeWithStudentId} ${staffTypeWithStudentId > 0 ? '?' : '?'}`);
      console.log(`  Student borrower_type WITH staff_id: ${studentTypeWithStaffId} ${studentTypeWithStaffId > 0 ? '?' : '?'}`);
    }

  } catch (error) {
    console.error('? Error analyzing Supabase schema:', error);
  }
}

analyzeSupabaseSchema();