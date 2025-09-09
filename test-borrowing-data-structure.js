import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

async function testBorrowingDataStructure() {
  console.log('?? Testing borrowing data structure and relationships...');
  
  // Connect to local database
  const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
  let localDb;
  
  try {
    localDb = new Database(localDbPath, { readonly: true });
    console.log('? Connected to local database');
  } catch (error) {
    console.error('? Could not connect to local database:', error);
    return;
  }

  try {
    console.log('\n?? TESTING DATA FETCHING LIKE THE APP DOES');
    console.log('=' * 60);
    
    // Test 1: Check borrower_type distribution
    console.log('\n1?? Checking borrower_type distribution:');
    const borrowerTypeStats = localDb.prepare(`
      SELECT 
        borrower_type,
        COUNT(*) as count,
        CASE 
          WHEN staff_id IS NOT NULL THEN 'HAS_STAFF_ID'
          WHEN student_id IS NOT NULL THEN 'HAS_STUDENT_ID'
          ELSE 'NO_IDS'
        END as id_type
      FROM borrowings 
      GROUP BY borrower_type, id_type
      ORDER BY count DESC
    `).all();
    
    borrowerTypeStats.forEach(stat => {
      console.log(`  ${stat.borrower_type || 'NULL'} (${stat.id_type}): ${stat.count}`);
    });
    
    // Test 2: Check staff borrowings specifically
    console.log('\n2?? Checking staff borrowings:');
    const staffBorrowings = localDb.prepare(`
      SELECT 
        b.id,
        b.borrower_type,
        b.staff_id,
        b.student_id,
        CASE 
          WHEN b.staff_id IS NOT NULL THEN 'staff'
          WHEN b.student_id IS NOT NULL THEN 'student'
          ELSE 'unknown'
        END as actual_type
      FROM borrowings b
      WHERE b.staff_id IS NOT NULL
      LIMIT 5
    `).all();
    
    console.log(`Found ${staffBorrowings.length} staff borrowings (sample):`);
    staffBorrowings.forEach(borrowing => {
      console.log(`  ID: ${borrowing.id}`);
      console.log(`    borrower_type: ${borrowing.borrower_type || 'NULL'}`);
      console.log(`    actual_type: ${borrowing.actual_type}`);
      console.log(`    staff_id: ${borrowing.staff_id}`);
      console.log('    ---');
    });
    
    // Test 3: Check the exact query that the app uses
    console.log('\n3?? Testing the app\'s query (get_borrowings_with_details):');
    const appQuery = localDb.prepare(`
      SELECT 
        b.id, b.student_id, b.staff_id, b.book_id, b.book_copy_id, 
        b.borrowed_date, b.due_date, b.returned_date, b.status, 
        b.fine_amount, b.notes, b.tracking_code, b.borrower_type,
        b.condition_at_issue, b.condition_at_return, b.return_notes, 
        b.is_lost, b.fine_paid, b.created_at, b.updated_at,
        
        -- Student info
        s.first_name as student_first_name, s.last_name as student_last_name,
        s.admission_number, s.class_grade,
        
        -- Staff info  
        st.first_name as staff_first_name, st.last_name as staff_last_name,
        st.staff_id as staff_identifier, st.department as staff_department,
        st.position as staff_position,
        
        -- Book info
        bk.title as book_title, bk.author as book_author, bk.book_code,
        
        -- Book copy info
        bc.legacy_book_id, bc.copy_identifier, bc.condition as copy_condition,
        bc.status as copy_status
        
      FROM borrowings b
      LEFT JOIN students s ON b.student_id = s.id AND (s.deleted = 0 OR s.deleted IS NULL)
      LEFT JOIN staff st ON b.staff_id = st.id AND (st.deleted = 0 OR st.deleted IS NULL)
      LEFT JOIN books bk ON b.book_id = bk.id AND (bk.deleted = 0 OR bk.deleted IS NULL)
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id AND (bc.deleted = 0 OR bc.deleted IS NULL)
      WHERE (b.deleted = 0 OR b.deleted IS NULL)
      ORDER BY b.created_at DESC
      LIMIT 10
    `).all();
    
    console.log(`App query returned ${appQuery.length} records:`);
    appQuery.forEach((record, index) => {
      console.log(`\n  ${index + 1}. Record ID: ${record.id}`);
      console.log(`     borrower_type: ${record.borrower_type || 'NULL'}`);
      console.log(`     staff_id: ${record.staff_id || 'NULL'}`);
      console.log(`     student_id: ${record.student_id || 'NULL'}`);
      console.log(`     legacy_book_id: ${record.legacy_book_id || 'NULL'}`);
      console.log(`     book_title: ${record.book_title || 'NULL'}`);
      console.log(`     staff_name: ${record.staff_first_name ? `${record.staff_first_name} ${record.staff_last_name}` : 'NULL'}`);
      console.log(`     student_name: ${record.student_first_name ? `${record.student_first_name} ${record.student_last_name}` : 'NULL'}`);
    });
    
    // Test 4: Check book_copies relationships specifically
    console.log('\n4?? Testing book_copies relationships:');
    const copyRelationshipCheck = localDb.prepare(`
      SELECT 
        COUNT(*) as total_borrowings,
        COUNT(CASE WHEN bc.id IS NOT NULL THEN 1 END) as with_copy_ref,
        COUNT(CASE WHEN bc.legacy_book_id IS NOT NULL THEN 1 END) as with_legacy_id,
        COUNT(CASE WHEN b.book_copy_id IS NOT NULL AND bc.id IS NULL THEN 1 END) as broken_refs
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
      WHERE (b.deleted = 0 OR b.deleted IS NULL)
    `).get();
    
    console.log('Book copy relationship stats:');
    console.log(`  Total borrowings: ${copyRelationshipCheck.total_borrowings}`);
    console.log(`  With valid copy reference: ${copyRelationshipCheck.with_copy_ref}`);
    console.log(`  With legacy book ID: ${copyRelationshipCheck.with_legacy_id}`);
    console.log(`  Broken references: ${copyRelationshipCheck.broken_refs}`);
    
    const connectionRate = ((copyRelationshipCheck.with_legacy_id / copyRelationshipCheck.total_borrowings) * 100).toFixed(2);
    console.log(`  Legacy ID connection rate: ${connectionRate}%`);
    
    // Test 5: Check if the staff classification logic works
    console.log('\n5?? Testing classification logic simulation:');
    const classificationTest = localDb.prepare(`
      SELECT 
        CASE 
          WHEN borrower_type = 'student' OR borrower_type IS NULL THEN 'SHOWS_AS_STUDENT'
          WHEN borrower_type = 'staff' THEN 'SHOWS_AS_STAFF'
          ELSE 'OTHER'
        END as classification,
        COUNT(*) as count
      FROM borrowings 
      WHERE (deleted = 0 OR deleted IS NULL)
      GROUP BY classification
    `).all();
    
    console.log('How records will be classified in the app:');
    classificationTest.forEach(stat => {
      console.log(`  ${stat.classification}: ${stat.count}`);
    });
    
    console.log('\n? Data structure test completed!');
    
  } catch (error) {
    console.error('? Error during testing:', error);
  } finally {
    if (localDb) {
      localDb.close();
    }
  }
}

// Run the test
testBorrowingDataStructure();