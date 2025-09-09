import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

// Supabase configuration
const supabaseUrl = 'https://ddlzenlqkofefdwdefzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixBorrowingIssues() {
  console.log('?? Starting to fix borrowing display issues...');
  
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
    console.log('\n?? ISSUE 1: Staff vs Student Classification');
    console.log('=' * 50);
    
    // Check current borrower type distribution in local database
    const borrowerTypeStats = localDb.prepare(`
      SELECT 
        borrower_type,
        COUNT(*) as count
      FROM borrowings 
      GROUP BY borrower_type
    `).all();
    
    console.log('Current local database borrower type distribution:');
    borrowerTypeStats.forEach(stat => {
      console.log(`  ${stat.borrower_type || 'NULL'}: ${stat.count}`);
    });
    
    // Check staff borrowings that might be misclassified
    const staffBorrowingsQuery = localDb.prepare(`
      SELECT 
        b.id,
        b.borrower_type,
        b.staff_id,
        b.student_id,
        CASE 
          WHEN b.staff_id IS NOT NULL THEN 'staff'
          WHEN b.student_id IS NOT NULL THEN 'student'
          ELSE 'unknown'
        END as correct_type
      FROM borrowings b
      WHERE (b.staff_id IS NOT NULL AND (b.borrower_type != 'staff' OR b.borrower_type IS NULL))
         OR (b.student_id IS NOT NULL AND (b.borrower_type != 'student' OR b.borrower_type IS NULL))
      LIMIT 10
    `).all();
    
    console.log('\n?? Sample misclassified borrowings:');
    staffBorrowingsQuery.forEach(borrowing => {
      console.log(`  ID: ${borrowing.id}`);
      console.log(`    Current type: ${borrowing.borrower_type || 'NULL'}`);
      console.log(`    Should be: ${borrowing.correct_type}`);
      console.log(`    Staff ID: ${borrowing.staff_id || 'NULL'}`);
      console.log(`    Student ID: ${borrowing.student_id || 'NULL'}`);
      console.log('    ---');
    });
    
    // Fix borrower type classification
    console.log('\n?? Fixing borrower type classification...');
    
    // Update staff borrowings
    const updateStaffResult = localDb.prepare(`
      UPDATE borrowings 
      SET borrower_type = 'staff'
      WHERE staff_id IS NOT NULL AND (borrower_type != 'staff' OR borrower_type IS NULL)
    `).run();
    
    console.log(`? Updated ${updateStaffResult.changes} staff borrowings`);
    
    // Update student borrowings
    const updateStudentResult = localDb.prepare(`
      UPDATE borrowings 
      SET borrower_type = 'student'
      WHERE student_id IS NOT NULL AND (borrower_type != 'student' OR borrower_type IS NULL)
    `).run();
    
    console.log(`? Updated ${updateStudentResult.changes} student borrowings`);
    
    // Check updated stats
    const updatedStats = localDb.prepare(`
      SELECT 
        borrower_type,
        COUNT(*) as count
      FROM borrowings 
      GROUP BY borrower_type
    `).all();
    
    console.log('\n?? Updated borrower type distribution:');
    updatedStats.forEach(stat => {
      console.log(`  ${stat.borrower_type || 'NULL'}: ${stat.count}`);
    });
    
    console.log('\n?? ISSUE 2: Legacy Book ID Display');
    console.log('=' * 50);
    
    // Check borrowing-to-book_copy relationships
    const relationshipCheck = localDb.prepare(`
      SELECT 
        COUNT(*) as total_borrowings,
        COUNT(bc.id) as borrowings_with_copies,
        COUNT(bc.legacy_book_id) as borrowings_with_legacy_ids
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
    `).get();
    
    console.log('Borrowing-to-book_copy relationship stats:');
    console.log(`  Total borrowings: ${relationshipCheck.total_borrowings}`);
    console.log(`  With book copies: ${relationshipCheck.borrowings_with_copies}`);
    console.log(`  With legacy book IDs: ${relationshipCheck.borrowings_with_legacy_ids}`);
    console.log(`  Connection rate: ${((relationshipCheck.borrowings_with_legacy_ids / relationshipCheck.total_borrowings) * 100).toFixed(2)}%`);
    
    // Check for borrowings with invalid book_copy_id references
    const invalidReferences = localDb.prepare(`
      SELECT 
        b.id,
        b.book_copy_id,
        b.book_id,
        bc.id as actual_copy_id
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
      WHERE b.book_copy_id IS NOT NULL AND bc.id IS NULL
      LIMIT 10
    `).all();
    
    if (invalidReferences.length > 0) {
      console.log('\n?? Found borrowings with invalid book_copy_id references:');
      invalidReferences.forEach(ref => {
        console.log(`  Borrowing ID: ${ref.id}, Invalid copy ID: ${ref.book_copy_id}`);
      });
      
      // Try to fix by matching with book_id
      console.log('\n?? Attempting to fix invalid book_copy_id references...');
      
      const fixReferencesQuery = `
        UPDATE borrowings 
        SET book_copy_id = (
          SELECT bc.id 
          FROM book_copies bc 
          WHERE bc.book_id = borrowings.book_id 
          LIMIT 1
        )
        WHERE book_copy_id IS NOT NULL 
        AND book_copy_id NOT IN (SELECT id FROM book_copies)
        AND book_id IS NOT NULL
      `;
      
      const fixResult = localDb.prepare(fixReferencesQuery).run();
      console.log(`? Fixed ${fixResult.changes} invalid book_copy_id references`);
    }
    
    // Check for borrowings without book_copy_id but with book_id that could be linked
    const missingCopyIds = localDb.prepare(`
      SELECT 
        COUNT(*) as borrowings_missing_copy_id
      FROM borrowings b
      WHERE b.book_copy_id IS NULL 
      AND b.book_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM book_copies bc WHERE bc.book_id = b.book_id)
    `).get();
    
    if (missingCopyIds.borrowings_missing_copy_id > 0) {
      console.log(`\n?? Found ${missingCopyIds.borrowings_missing_copy_id} borrowings missing book_copy_id`);
      console.log('?? Fixing missing book_copy_id references...');
      
      const fixMissingQuery = `
        UPDATE borrowings 
        SET book_copy_id = (
          SELECT bc.id 
          FROM book_copies bc 
          WHERE bc.book_id = borrowings.book_id 
          LIMIT 1
        )
        WHERE book_copy_id IS NULL 
        AND book_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM book_copies bc WHERE bc.book_id = borrowings.book_id)
      `;
      
      const fixMissingResult = localDb.prepare(fixMissingQuery).run();
      console.log(`? Fixed ${fixMissingResult.changes} missing book_copy_id references`);
    }
    
    // Final verification
    const finalCheck = localDb.prepare(`
      SELECT 
        COUNT(*) as total_borrowings,
        COUNT(bc.id) as borrowings_with_copies,
        COUNT(bc.legacy_book_id) as borrowings_with_legacy_ids
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
    `).get();
    
    console.log('\n?? Final relationship stats after fixes:');
    console.log(`  Total borrowings: ${finalCheck.total_borrowings}`);
    console.log(`  With book copies: ${finalCheck.borrowings_with_copies}`);
    console.log(`  With legacy book IDs: ${finalCheck.borrowings_with_legacy_ids}`);
    console.log(`  Connection rate: ${((finalCheck.borrowings_with_legacy_ids / finalCheck.total_borrowings) * 100).toFixed(2)}%`);
    
    // Show some sample fixed borrowings
    const sampleFixed = localDb.prepare(`
      SELECT 
        b.id,
        b.borrower_type,
        bc.legacy_book_id,
        bk.title
      FROM borrowings b
      LEFT JOIN book_copies bc ON b.book_copy_id = bc.id
      LEFT JOIN books bk ON b.book_id = bk.id
      WHERE bc.legacy_book_id IS NOT NULL
      LIMIT 5
    `).all();
    
    console.log('\n?? Sample borrowings with legacy book IDs:');
    sampleFixed.forEach(borrowing => {
      console.log(`  ${borrowing.borrower_type}: "${borrowing.title}" (Legacy ID: ${borrowing.legacy_book_id})`);
    });
    
    console.log('\n? All fixes completed! Please restart the application to see the changes.');
    
  } catch (error) {
    console.error('? Error during fix process:', error);
  } finally {
    if (localDb) {
      localDb.close();
    }
  }
}

// Run the fix
fixBorrowingIssues();