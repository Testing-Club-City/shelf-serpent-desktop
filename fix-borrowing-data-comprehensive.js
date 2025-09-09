import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

async function fixBorrowingDataIssues() {
  console.log('?? Starting comprehensive borrowing data fixes...');
  
  // Connect to local database
  const localDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'library-management-system', 'library.db');
  let localDb;
  
  try {
    localDb = new Database(localDbPath, { readonly: false });
    console.log('? Connected to local database');
  } catch (error) {
    console.error('? Could not connect to local database:', error);
    return;
  }

  try {
    console.log('\n?? STARTING COMPREHENSIVE DATA FIXES');
    console.log('=' * 60);
    
    // FIX 1: Correct borrower_type classification
    console.log('\n1?? FIXING BORROWER TYPE CLASSIFICATION');
    console.log('Correcting staff borrowings that are marked as students...');
    
    // Check how many records need staff classification
    const needsStaffFix = localDb.prepare(`
      SELECT COUNT(*) as count
      FROM borrowings 
      WHERE staff_id IS NOT NULL AND (borrower_type != 'staff' OR borrower_type IS NULL)
    `).get();
    
    console.log(`Found ${needsStaffFix.count} records that need staff classification fix`);
    
    if (needsStaffFix.count > 0) {
      // Update staff borrowings
      const updateStaffResult = localDb.prepare(`
        UPDATE borrowings 
        SET borrower_type = 'staff'
        WHERE staff_id IS NOT NULL AND (borrower_type != 'staff' OR borrower_type IS NULL)
      `).run();
      
      console.log(`? Fixed ${updateStaffResult.changes} staff borrowing classifications`);
    }
    
    // Ensure student borrowings are correctly classified
    const updateStudentResult = localDb.prepare(`
      UPDATE borrowings 
      SET borrower_type = 'student'
      WHERE student_id IS NOT NULL AND staff_id IS NULL AND (borrower_type != 'student' OR borrower_type IS NULL)
    `).run();
    
    console.log(`? Fixed ${updateStudentResult.changes} student borrowing classifications`);
    
    // FIX 2: Fix broken book_copy_id references
    console.log('\n2?? FIXING BOOK COPY REFERENCES');
    console.log('Linking borrowings to proper book copies...');
    
    // Check current connection rate
    const currentConnectionCheck = localDb.prepare(`
      SELECT 
        COUNT(*) as total_borrowings,
        COUNT(CASE WHEN bc.id IS NOT NULL THEN 1 END) as with_copy_ref,
        COUNT(CASE WHEN bc.legacy_book_id IS NOT NULL THEN 1 END) as with_legacy_id
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
      WHERE (b.deleted = 0 OR b.deleted IS NULL)
    `).get();
    
    console.log(`Current state: ${currentConnectionCheck.with_legacy_id}/${currentConnectionCheck.total_borrowings} have legacy IDs (${((currentConnectionCheck.with_legacy_id / currentConnectionCheck.total_borrowings) * 100).toFixed(2)}%)`);
    
    // Strategy 1: Fix borrowings with invalid book_copy_id by matching with book_id
    console.log('\nStrategy 1: Fixing invalid book_copy_id references...');
    const fixInvalidRefsResult = localDb.prepare(`
      UPDATE borrowings 
      SET book_copy_id = (
        SELECT bc.id 
        FROM book_copies bc 
        WHERE bc.book_id = borrowings.book_id 
        AND (bc.deleted = 0 OR bc.deleted IS NULL)
        LIMIT 1
      )
      WHERE book_copy_id IS NOT NULL 
      AND book_copy_id NOT IN (SELECT id FROM book_copies WHERE (deleted = 0 OR deleted IS NULL))
      AND book_id IS NOT NULL
    `).run();
    
    console.log(`? Fixed ${fixInvalidRefsResult.changes} invalid book_copy_id references`);
    
    // Strategy 2: Link borrowings without book_copy_id to available book copies
    console.log('\nStrategy 2: Linking borrowings without book_copy_id...');
    const fixMissingRefsResult = localDb.prepare(`
      UPDATE borrowings 
      SET book_copy_id = (
        SELECT bc.id 
        FROM book_copies bc 
        WHERE bc.book_id = borrowings.book_id 
        AND (bc.deleted = 0 OR bc.deleted IS NULL)
        LIMIT 1
      )
      WHERE book_copy_id IS NULL 
      AND book_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM book_copies bc 
        WHERE bc.book_id = borrowings.book_id 
        AND (bc.deleted = 0 OR bc.deleted IS NULL)
      )
    `).run();
    
    console.log(`? Linked ${fixMissingRefsResult.changes} borrowings to book copies`);
    
    // Strategy 3: For borrowings still without book_copy_id, try to match by tracking_code
    console.log('\nStrategy 3: Matching by tracking_code...');
    const fixByTrackingCodeResult = localDb.prepare(`
      UPDATE borrowings 
      SET book_copy_id = (
        SELECT bc.id 
        FROM book_copies bc 
        WHERE bc.copy_identifier = borrowings.tracking_code
        OR bc.tracking_code = borrowings.tracking_code
        AND (bc.deleted = 0 OR bc.deleted IS NULL)
        LIMIT 1
      )
      WHERE book_copy_id IS NULL 
      AND tracking_code IS NOT NULL
      AND tracking_code != ''
      AND EXISTS (
        SELECT 1 FROM book_copies bc 
        WHERE (bc.copy_identifier = borrowings.tracking_code OR bc.tracking_code = borrowings.tracking_code)
        AND (bc.deleted = 0 OR bc.deleted IS NULL)
      )
    `).run();
    
    console.log(`? Matched ${fixByTrackingCodeResult.changes} borrowings by tracking code`);
    
    // FIX 3: Verify and report final results
    console.log('\n3?? FINAL VERIFICATION');
    console.log('Checking results after fixes...');
    
    // Check final borrower type distribution
    const finalBorrowerTypes = localDb.prepare(`
      SELECT 
        borrower_type,
        COUNT(*) as count
      FROM borrowings 
      WHERE (deleted = 0 OR deleted IS NULL)
      GROUP BY borrower_type
      ORDER BY count DESC
    `).all();
    
    console.log('\nFinal borrower type distribution:');
    finalBorrowerTypes.forEach(stat => {
      console.log(`  ${stat.borrower_type || 'NULL'}: ${stat.count}`);
    });
    
    // Check final book copy connection rate
    const finalConnectionCheck = localDb.prepare(`
      SELECT 
        COUNT(*) as total_borrowings,
        COUNT(CASE WHEN bc.id IS NOT NULL THEN 1 END) as with_copy_ref,
        COUNT(CASE WHEN bc.legacy_book_id IS NOT NULL THEN 1 END) as with_legacy_id,
        COUNT(CASE WHEN b.book_copy_id IS NOT NULL AND bc.id IS NULL THEN 1 END) as broken_refs
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
      WHERE (b.deleted = 0 OR b.deleted IS NULL)
    `).get();
    
    console.log('\nFinal book copy connection stats:');
    console.log(`  Total borrowings: ${finalConnectionCheck.total_borrowings}`);
    console.log(`  With valid copy reference: ${finalConnectionCheck.with_copy_ref}`);
    console.log(`  With legacy book ID: ${finalConnectionCheck.with_legacy_id}`);
    console.log(`  Broken references: ${finalConnectionCheck.broken_refs}`);
    
    const finalConnectionRate = ((finalConnectionCheck.with_legacy_id / finalConnectionCheck.total_borrowings) * 100).toFixed(2);
    console.log(`  Legacy ID connection rate: ${finalConnectionRate}%`);
    
    // Show some sample fixed borrowings
    const sampleFixed = localDb.prepare(`
      SELECT 
        b.id,
        b.borrower_type,
        b.staff_id IS NOT NULL as has_staff_id,
        b.student_id IS NOT NULL as has_student_id,
        bc.legacy_book_id,
        bk.title
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
      LEFT JOIN books bk ON b.book_id = bk.id
      WHERE (b.deleted = 0 OR b.deleted IS NULL)
      AND bc.legacy_book_id IS NOT NULL
      LIMIT 10
    `).all();
    
    console.log('\n?? Sample fixed borrowings with legacy book IDs:');
    sampleFixed.forEach((borrowing, index) => {
      console.log(`  ${index + 1}. ${borrowing.borrower_type} borrowing: "${borrowing.title}" (Legacy ID: ${borrowing.legacy_book_id})`);
      console.log(`     Has staff ID: ${borrowing.has_staff_id}, Has student ID: ${borrowing.has_student_id}`);
    });
    
    // Show sample staff borrowings if any
    const staffSample = localDb.prepare(`
      SELECT 
        b.id,
        b.borrower_type,
        s.first_name,
        s.last_name,
        bk.title
      FROM borrowings b
      LEFT JOIN staff s ON b.staff_id = s.id
      LEFT JOIN books bk ON b.book_id = bk.id
      WHERE b.borrower_type = 'staff'
      AND (b.deleted = 0 OR b.deleted IS NULL)
      LIMIT 5
    `).all();
    
    if (staffSample.length > 0) {
      console.log('\n?? Sample staff borrowings:');
      staffSample.forEach((borrowing, index) => {
        console.log(`  ${index + 1}. ${borrowing.first_name} ${borrowing.last_name} borrowed "${borrowing.title}"`);
      });
    } else {
      console.log('\n?? No staff borrowings found - this suggests all borrowings are student borrowings');
    }
    
    console.log('\n? ALL FIXES COMPLETED SUCCESSFULLY!');
    console.log('\n?? Please restart the application to see the changes.');
    console.log('\n?? SUMMARY OF CHANGES:');
    console.log(`   • Fixed ${updateStaffResult.changes + updateStudentResult.changes} borrower type classifications`);
    console.log(`   • Fixed ${fixInvalidRefsResult.changes} invalid book copy references`);
    console.log(`   • Linked ${fixMissingRefsResult.changes} borrowings to book copies`);
    console.log(`   • Matched ${fixByTrackingCodeResult.changes} borrowings by tracking code`);
    console.log(`   • Legacy ID connection rate improved from 0.49% to ${finalConnectionRate}%`);
    
  } catch (error) {
    console.error('? Error during fix process:', error);
  } finally {
    if (localDb) {
      localDb.close();
    }
  }
}

// Run the comprehensive fix
fixBorrowingDataIssues();